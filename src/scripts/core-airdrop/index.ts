import {
  AccountInfo,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
  RpcResponseAndContext,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as https from "https";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  basePluginAuthority,
  create,
  mplCore,
  pluginAuthority,
  pluginAuthorityFromBase,
  PluginAuthorityPair,
  pluginAuthorityPair,
  pluginAuthorityPairV2,
  transfer,
  transferV1,
} from "@metaplex-foundation/mpl-core";
import {
  mplTokenMetadata,
  unverifyCollectionV1,
  Metadata,
  unverifyCreatorV1,
  fetchMasterEditionFromSeeds,
  findMasterEditionPda,
  removeCreatorVerification,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  Umi,
  PublicKey as PublicKeyUmi,
  publicKey,
  Keypair as KeypairUmi,
  signerPayer,
  keypairIdentity,
  generateSigner,
  createNoopSigner,
  chunk,
  TransactionBuilder,
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  fromWeb3JsKeypair,
  toWeb3JsPublicKey,
  toWeb3JsInstruction,
  toWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";
import { readFileSync } from "fs";
import {
  updateV1,
  fetchMetadataFromSeeds,
} from "@metaplex-foundation/mpl-token-metadata";
import { fetchJson, getCurrentLocalTime, loadJson, loadWallet } from "./utils";
import * as bs58 from "bs58";
import ProgressBar from "progress";
import PromisePool from "@supercharge/promise-pool";

let interrupted = false;
process.on("SIGINT", () => {
  interrupted = true;
  console.log("Process interrupted. Marking remaining tasks as skipped.");
});

class CoreUpdater {
  connection: Connection;
  mintSkipList: string[];
  umi: Umi;
  unverifiedMetadata: Record<string, any>;
  aurorianCollection: string;
  authority: KeypairUmi;
  newAurorianCollection: PublicKeyUmi;
  nameToSeq: any;
  newAuthority: KeypairUmi;
  seqToMint: Record<string, { publicKey: string; secretKey: string }>;
  oldMintToSeq: Record<string, number>;
  constructor() {
    this.connection = new Connection(process.env.RPC_PROD, {
      commitment: "recent",
    });
    this.authority = fromWeb3JsKeypair(
      loadWallet(process.env.WALLET_aury7LJUae7a92PBo35vVbP61GX8VbyxFKausvUtBrt)
    );
    this.newAuthority = fromWeb3JsKeypair(
      loadWallet(
        process.env.WALLET_AUrJmx5NmEDK94YWGevJ46UCyiqWhydy5ZdjxgmizKG5 as any
      )
    );
    this.umi = createUmi(this.connection)
      .use(mplCore())
      .use(mplTokenMetadata())
      .use(keypairIdentity(this.authority))
      .use(keypairIdentity(this.newAuthority));

    this.mintSkipList = [
      "CfQvAQyndqg73HmAsG1viEqoqYzf7Tt2koPW8HFmzhXF",
      "DpXvwSuJpDpbtxBzussg6MFjeKG4AqhCyigdsdyzZDnD",
    ];
    this.unverifiedMetadata = loadJson(
      __dirname + "/../unverified-metadata.json"
    );
    this.aurorianCollection = "7BQdHnBKERaCYCnwLbbSoYHQZxcq7zLenYERDp94o18z";
    this.newAurorianCollection = publicKey(
      "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
    );

    const consolidatedDataList = loadJson(process.env.CONSOLIDATED_DATA_PATH);
    this.nameToSeq = this.formatConsolidatedData(consolidatedDataList);
    this.seqToMint = loadJson(__dirname + "/snapshot/seq-to-mint.json");
    this.oldMintToSeq = loadJson(__dirname + "/snapshot/old-mint-to-seq.json");
  }

  private formatConsolidatedData(data: any) {
    const nameToSeq = {};
    for (let index = 0; index < data.length; index++) {
      const metadata = data[index];
      const seq = metadata.attributes.find(
        (v) => v.trait_type === "sequence" || v.trait_type === " sequence"
      ).value;
      nameToSeq[metadata.name.trim()] = seq;
    }
    return nameToSeq;
  }

  async init() {
    const banxFetchUrl =
      "https://api.banx.gg/loans/loans-by-market?markets=Aurory";
    const banxSkipList = ((await fetchJson(banxFetchUrl)) as any).data.nfts.map(
      (v) => v.nft.mint
    );
    this.mintSkipList.push(...banxSkipList);
  }

  private async getMintOwner(
    mint: string
  ): Promise<{ owner: PublicKey; tokenAccount: PublicKey }> {
    const tla = await this.connection.getTokenLargestAccounts(
      new PublicKey(mint)
    );
    const tokenAccount = tla.value.filter((account) => account.uiAmount > 0)[0]
      .address;
    const pai = (await this.connection.getParsedAccountInfo(
      tokenAccount
    )) as RpcResponseAndContext<AccountInfo<ParsedAccountData>>;
    const owner = new PublicKey(pai.value.data.parsed.info.owner);
    return { tokenAccount, owner };
  }

  private async updateBatch(
    mint: string,
    index: number
  ): Promise<
    | null
    | { signature: string; error: null; owner: string }
    | { signature: null; error: any; owner: string }
  > {
    let txBuilder = new TransactionBuilder();
    const { tokenAccount, owner } = await this.getMintOwner(mint);
    // check if owner's wallet is on Ed25519 curve
    if (!PublicKey.isOnCurve(owner)) {
      return {
        error: `${mint} owner is not on Ed25519 curve (${owner})`,
        signature: null,
        owner: owner.toString(),
      };
    }

    const newMint = this.seqToMint[this.oldMintToSeq[mint]].publicKey;
    // fetch initial Metadata
    const initialMetadata: Metadata = await fetchMetadataFromSeeds(this.umi, {
      mint: publicKey(mint),
    });
    const masterEdition = findMasterEditionPda(this.umi, {
      mint: publicKey(mint),
    });
    txBuilder = txBuilder
      .add(
        await updateV1(this.umi, {
          mint: publicKey(mint),
          data: {
            ...initialMetadata,
            uri: "https://aurorians.cdn.aurory.io/aurorians-v2/unverified-metadata.json",
          },
          primarySaleHappened: true,
          isMutable: true,
          authority: createNoopSigner(this.authority.publicKey),
          edition: masterEdition,
        })
      )
      .add(
        await unverifyCollectionV1(this.umi, {
          metadata: initialMetadata.publicKey,
          collectionMint: publicKey(this.aurorianCollection),
          authority: createNoopSigner(this.authority.publicKey),
        })
      )
      .add(
        await unverifyCreatorV1(this.umi, {
          metadata: initialMetadata.publicKey,
          authority: createNoopSigner(this.authority.publicKey),
        })
      )
      .add(
        await transferV1(this.umi, {
          asset: publicKey(newMint),
          newOwner: publicKey(owner),
          collection: publicKey(this.newAurorianCollection),
        })
      );

    const ixs = await txBuilder.getInstructions();
    let latestBlockhash = await this.connection.getLatestBlockhash("recent");
    const messageV0 = new TransactionMessage({
      payerKey: toWeb3JsPublicKey(this.newAuthority.publicKey),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 100000,
          // microLamports: 50000,
        }),
      ].concat(ixs.map((ix) => toWeb3JsInstruction(ix))),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    tx.sign([
      toWeb3JsKeypair(this.authority),
      toWeb3JsKeypair(this.newAuthority),
    ]);

    const sim = await this.connection.simulateTransaction(tx);
    if (sim.value.err !== null) {
      console.log(mint, this.oldMintToSeq[mint], sim);
    }
    const signature = "";
    // const signature = await this.connection.sendTransaction(tx, {
    //   skipPreflight: false,
    // });
    return { signature, error: null, owner: owner.toString() };
  }

  async run() {
    // 1) Open mint list
    /**
     * 2) for each check if:
     * * owner's wallet is on Ed25519 curve
     * * is not lended on sharkyfi or banx
     * * is not among the 2 unverified as tests
     * * fetch uri from metadata and check if name + concatenated value is equal to the one from local metadata
     *
     * 3) Create tx to unverify + airdrop new aurorian:
     * * a) unverify creator + collection
     * * b) update metadata uri to https://aurorians.cdn.aurory.io/aurorians-v2/unverified-metadata.json
     * * c) airdrop new aurorian in frozen state
     * 4) Save tx signature + mint to a file
     * 5) Redo from step 3 but by loading tx signature + mint from file
     */
    // const aurorianMintsPath = `${process.env.PROCESSED_FILES_PATH}/mint_addresses.json`;
    // const aurorianMints: string[] = loadJson(aurorianMintsPath)
    //   .filter((mint) => !this.mintSkipList.includes(mint))
    //   .slice(58, -1);

    const previousTxs: {
      index: number;
      signature: null | string;
      error: null | string;
      mint: string;
      owner: string;
    }[] = loadJson(
      __dirname + "/snapshot/results-update-06-00-56-36.json"
    ).filter((tx) => tx.signature);
    const signaturesTxsChunks = chunk(previousTxs, 255);

    console.log(signaturesTxsChunks.length);
    const numThreads = 10;
    const { results: resultsSignatures, errors: errorsSignatures } =
      await PromisePool.withConcurrency(numThreads)
        .for(signaturesTxsChunks)
        .process(async (signaturesTxsChunk) => {
          const signatures = signaturesTxsChunk.map((tx) => tx.signature);
          const retryIndexes = [];
          const statuses = await this.connection.getSignatureStatuses(
            signatures,
            {
              searchTransactionHistory: true,
            }
          );
          for (let index2 = 0; index2 < statuses.value.length; index2++) {
            const status = statuses.value[index2];
            if (status === null || status.err !== null) {
              retryIndexes.push(signaturesTxsChunk[index2]);
            }
          }
          return retryIndexes;
        });

    const aurorianMints = resultsSignatures.flat().map(({ mint }) => mint);
    // console.log(aurorianMints.length);
    // return;
    if (aurorianMints.length === 0) return;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    console.log("Starting in 5s");
    await delay(5000);
    const start = 0;
    const bar = new ProgressBar("[:bar] :current/:total :percent :etas", {
      total: aurorianMints.length - start,
      width: 40,
    });
    bar.tick(0);
    const { results, errors } = await PromisePool.withConcurrency(numThreads)
      .for(aurorianMints)
      .process(async (mint, index) => {
        if (interrupted || index < start) {
          return { skip: true };
        }
        if (index && index % (numThreads * 10) === 0) {
          bar.tick(numThreads * 10);
        }
        let signature = null;
        let error = null;
        let owner = null;
        try {
          const res = await this.updateBatch(mint, index);
          signature = res.signature;
          error = res.error;
          owner = res.owner;
        } catch (e: any) {
          console.log(e);
          error = e.message;
        }
        await delay(500);
        return { index, signature, error, mint, owner };
      });
    bar.terminate();

    const filteredResults = results.filter((result) => !result.skip);

    const savePath =
      __dirname + `/snapshot/results-update-${getCurrentLocalTime()}.json`;
    fs.writeFileSync(savePath, JSON.stringify(filteredResults, null, 2));
    console.log(`Results saved to ${savePath}`);
  }
}

async function run() {
  const cu = new CoreUpdater();
  await cu.init();
  await cu.run();
}

run();

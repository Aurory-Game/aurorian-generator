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
  createPlugin,
  fetchAsset,
  fetchAssetsByCollection,
  mplCore,
  pluginAuthority,
  pluginAuthorityFromBase,
  PluginAuthorityPair,
  pluginAuthorityPair,
  pluginAuthorityPairV2,
  transfer,
  transferV1,
  updatePluginV1,
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
  authority: KeypairUmi;
  newAurorianCollection: PublicKeyUmi;
  nameToSeq: any;
  newAuthority: KeypairUmi;
  seqToMint: Record<string, { publicKey: string; secretKey: string }>;
  oldMintToSeq: Record<string, number>;
  ssMintToWallet: Record<string, string>;
  newAuthority2: KeypairUmi;
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
    this.newAuthority2 = fromWeb3JsKeypair(
      loadWallet(
        process.env.WALLET_paurUkH96miLCY531mvt3Kmna7W9aD7x2zUijRHhEcG as any
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
    this.newAurorianCollection = publicKey(
      "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
    );

    const consolidatedDataList = loadJson(process.env.CONSOLIDATED_DATA_PATH);
    this.nameToSeq = this.formatConsolidatedData(consolidatedDataList);
    this.seqToMint = loadJson(__dirname + "/snapshot/seq-to-mint.json");
    this.oldMintToSeq = loadJson(__dirname + "/snapshot/old-mint-to-seq.json");
    this.ssMintToWallet = loadJson(
      __dirname + "/snapshot/ss-mint-to-wallet.json"
    );
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

  private async updateBatch(
    mintOwners: [string, string][]
  ): Promise<
    null | { signature: string; error: null } | { signature: null; error: any }
  > {
    let txBuilder = new TransactionBuilder();

    for (let index = 0; index < mintOwners.length; index++) {
      const [mint, owner] = mintOwners[index];
      txBuilder = txBuilder.add(
        await updatePluginV1(this.umi, {
          asset: publicKey(mint),
          plugin: createPlugin({
            type: "PermanentFreezeDelegate",
            data: {
              frozen: true,
            },
          }),
          authority: createNoopSigner(this.newAuthority2.publicKey),
          collection: this.newAurorianCollection,
        })
      );
    }

    const ixs = await txBuilder.getInstructions();

    let latestBlockhash = await this.connection.getLatestBlockhash("recent");
    const messageV0 = new TransactionMessage({
      payerKey: toWeb3JsPublicKey(this.newAuthority2.publicKey),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({
          // microLamports: 100000,
          microLamports: 50000,
        }),
      ].concat(ixs.map((ix) => toWeb3JsInstruction(ix))),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    tx.sign([
      toWeb3JsKeypair(this.newAuthority2),
      toWeb3JsKeypair(this.newAuthority),
    ]);

    // const sim = await this.connection.simulateTransaction(tx);
    // if (sim.value.err !== null) {
    //   console.log(sim);
    // }
    // const signature = "";
    const signature = await this.connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    return { signature, error: null };
  }

  async run() {
    const previousTxs: {
      index: number;
      signature: null | string;
      error: null | string;
      mint: string;
      owner: string;
    }[] = loadJson(
      __dirname + "/snapshot/results-freeze-SS-06-05-27-03.json"
    ).filter((tx) => tx.signature);
    const signaturesTxsChunks = chunk(previousTxs, 255);
    const numThreads = 5;

    console.log(signaturesTxsChunks.length);
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

    const aurorianMintsWalletsChunks = resultsSignatures
      .flat()
      .map(({ mintOwners }) => mintOwners);
    console.log(aurorianMintsWalletsChunks.length);
    if (aurorianMintsWalletsChunks.length === 0) return;
    // return;
    // const aurorianMintsWalletsRaw = Object.entries(this.ssMintToWallet);
    // console.log(aurorianMintsWalletsRaw.length);
    // const aurorianMintsWallets: [string, string][] = [];
    // const assetsByCollection = await fetchAssetsByCollection(
    //   this.umi,
    //   this.newAurorianCollection,
    //   {
    //     skipDerivePlugins: false,
    //   }
    // );
    // const assetToOwner = {};
    // for (let index = 0; index < assetsByCollection.length; index++) {
    //   const asset = assetsByCollection[index];
    //   assetToOwner[asset.publicKey] = asset.owner;
    // }
    // for (let index = 50; index < aurorianMintsWalletsRaw.length; index++) {
    //   if (interrupted) return;
    //   const [mint, wallet] = aurorianMintsWalletsRaw[index];
    //   try {
    //     const newMint = this.seqToMint[this.oldMintToSeq[mint]].publicKey;
    //     if (assetToOwner[newMint] == wallet)
    //       aurorianMintsWallets.push([newMint, wallet]);
    //   } catch (e) {
    //     console.log(`Error for ${mint}`);
    //   }
    // }
    // console.log(aurorianMintsWallets.length);
    // const aurorianMintsWalletsChunks: [string, string][][] = chunk(
    //   aurorianMintsWallets,
    //   17
    // );
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    console.log("Starting in 5s");
    await delay(5000);
    if (interrupted) return;
    const start = 0;
    const bar = new ProgressBar("[:bar] :current/:total :percent :etas", {
      total: aurorianMintsWalletsChunks.length - start,
      width: 40,
    });
    bar.tick(0);
    const { results, errors } = await PromisePool.withConcurrency(numThreads)
      .for(aurorianMintsWalletsChunks)
      .process(async (mintOwners, index) => {
        if (interrupted || index < start) {
          return { skip: true };
        }
        if (index && index % (numThreads * 10) === 0) {
          bar.tick(numThreads * 10);
        }
        let signature = null;
        let error = null;
        try {
          const res = await this.updateBatch(mintOwners);
          signature = res.signature;
          error = res.error;
        } catch (e: any) {
          console.log(e);
          error = e.message;
        }
        await delay(500);
        return { index, signature, error, mintOwners };
      });
    bar.terminate();
    const filteredResults = results.filter((result) => !result.skip);

    const savePath =
      __dirname + `/snapshot/results-freeze-SS-${getCurrentLocalTime()}.json`;
    fs.writeFileSync(savePath, JSON.stringify(filteredResults, null, 2));
    console.log(`Results saved to ${savePath}`);
  }
}

async function run() {
  const cu = new CoreUpdater();
  await cu.run();
}

run();

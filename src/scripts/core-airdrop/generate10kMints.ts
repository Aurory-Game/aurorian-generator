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
import {
  chunk,
  fetchJson,
  getCurrentLocalTime,
  loadJson,
  loadWallet,
} from "./utils";
import * as bs58 from "bs58";
import { PromisePool } from "@supercharge/promise-pool";
import ProgressBar from "progress";

let interrupted = false;
// process.on("SIGINT", () => {
//   interrupted = true;
//   console.log("Process interrupted. Marking remaining tasks as skipped.");
// });
class CoreUpdater {
  connection: Connection;
  mintSkipList: string[];
  umi: Umi;
  unverifiedMetadata: Record<string, any>;
  aurorianCollection: string;
  authority: KeypairUmi;
  newAurorianCollection: PublicKeyUmi;
  seqToName: any;
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
      // .use(keypairIdentity(this.authority))
      .use(keypairIdentity(this.newAuthority));

    this.aurorianCollection = "7BQdHnBKERaCYCnwLbbSoYHQZxcq7zLenYERDp94o18z";
    this.newAurorianCollection = publicKey(
      "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
    );
    const consolidatedDataList = loadJson(process.env.CONSOLIDATED_DATA_PATH);
    this.seqToMint = loadJson(__dirname + "/snapshot/seq-to-mint.json");
    this.seqToName = this.formatConsolidatedData(consolidatedDataList);
  }

  private formatConsolidatedData(data: any) {
    const seqToName = {};
    for (let index = 0; index < data.length; index++) {
      const metadata = data[index];
      const seq = metadata.attributes.find(
        (v) => v.trait_type === "sequence" || v.trait_type === " sequence"
      ).value;
      seqToName[seq] = metadata.name.trim();
    }
    return seqToName;
  }

  async mintBatch(batchIndex: number, batchSize: number): Promise<string> {
    const seqStart = batchIndex * 4 + 1;
    let txBuilder = new TransactionBuilder();
    const assetSigners: Keypair[] = [];
    for (let seq = seqStart; seq < seqStart + batchSize; seq++) {
      const name = this.seqToName[seq];
      const { publicKey: pk, secretKey } = this.seqToMint[seq];
      assetSigners.push(
        Keypair.fromSecretKey(new Uint8Array(Buffer.from(secretKey, "base64")))
      );
      txBuilder = txBuilder.add(
        create(this.umi, {
          asset: createNoopSigner(publicKey(pk)),
          authority: createNoopSigner(this.newAuthority.publicKey),
          collection: {
            publicKey: this.newAurorianCollection,
          },
          name: name,
          uri: `https://aurorians.cdn.aurory.io/aurorians-v2/current/metadata/${seq}.json`,
          plugins: [
            {
              type: "PermanentFreezeDelegate",
              frozen: false,
              authority: {
                type: "UpdateAuthority",
              },
            },
            {
              type: "TransferDelegate",
              authority: {
                type: "UpdateAuthority",
              },
            },
          ],
        })
      );
    }
    const ixs = await txBuilder.getInstructions();
    const latestBlockhash = await this.connection.getLatestBlockhash("recent");
    const messageV0 = new TransactionMessage({
      payerKey: toWeb3JsPublicKey(this.newAuthority.publicKey),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50000,
        }),
      ].concat(ixs.map((ix) => toWeb3JsInstruction(ix))),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    tx.sign([toWeb3JsKeypair(this.newAuthority)].concat(assetSigners));

    // const sim = await this.connection.simulateTransaction(tx);
    // if (sim.value.err !== null) {
    //   throw new Error(JSON.stringify(sim.value.err));
    // }
    const signature = await this.connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    return signature;
  }

  async run() {
    // 1 à 2499
    // le sript check le nom pour chacun dans seq to name
    // execute le script et renvoie indice de départ + signature
    // run sauvegarde les signatures même en cas d'erreur

    // const aurorianMintsPath = `${process.env.PROCESSED_FILES_PATH}/mint_addresses.json`;
    // const aurorianMints = loadJson(aurorianMintsPath);
    // const aurorianMintsChunks = chunk(aurorianMints, 4);
    // const signature = await this.mintBatch(aurorianMintsChunks[0], 0);

    const previousTxs = loadJson(
      __dirname + "/snapshot/results-05-21-30-08.json"
    );
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

    const indexesToRetry = resultsSignatures
      .flat()
      .map(({ index }) => parseInt(index));
    if (indexesToRetry.length === 0) return;
    indexesToRetry.sort((a, b) => a - b);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const batchSize = 4;
    const start = 0;
    const bar = new ProgressBar("[:bar] :current/:total :percent :etas", {
      total: indexesToRetry.length ? indexesToRetry.length : 2500 - start,
      width: 40,
    });
    bar.tick(0);
    const data = indexesToRetry.length
      ? indexesToRetry
      : Array.from({ length: 2500 }, (_, i) => i);
    const { results, errors } = await PromisePool.withConcurrency(numThreads)
      .for(data)
      // .for([497, 498])
      .process(async (index) => {
        if (interrupted || index < start) {
          return { skip: true };
        }
        if (index && index % (numThreads * 10) === 0) {
          bar.tick(numThreads * 10);
        }
        let signature;
        let error = null;
        try {
          signature = await this.mintBatch(index, batchSize);
        } catch (e: any) {
          console.log(e);
          error = e.message;
          signature = null;
        }
        await delay(500);
        return { index, signature, error };
      });
    bar.terminate();

    const filteredResults = results.filter((result) => !result.skip);

    const savePath =
      __dirname + `/snapshot/results-${getCurrentLocalTime()}.json`;
    fs.writeFileSync(savePath, JSON.stringify(filteredResults, null, 2));
    console.log(`Results saved to ${savePath}`);
  }
}
async function run() {
  const cu = new CoreUpdater();
  await cu.run();
}

run();

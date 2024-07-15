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
  burn,
  create,
  fetchAsset,
  mplCore,
  pluginAuthority,
  pluginAuthorityFromBase,
  PluginAuthorityPair,
  pluginAuthorityPair,
  pluginAuthorityPairV2,
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
  seqToName: any;
  newAuthority: KeypairUmi;
  seqToMint: Record<string, { publicKey: string; secretKey: string }>;
  cashAuthority: KeypairUmi;

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
    this.cashAuthority = fromWeb3JsKeypair(
      loadWallet(
        process.env.WALLET_CASHaa4PzBAYiy9K1qszEHp4a2KSmNmCWboEYNXVatTr as any
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

  async run() {
    const mints = [
      "CtiyGFt15n5rXamP8ZPysufWR2Ln4f9gEbnNvZnoiZYh",
      "BsKKAp8Sunr57zU4V6LPmVjZZozJCdRG6oADdatxq25e",
      "38C3iTsvVSb3mRZR11fxNTQJoXsHEriTMMAYboAKXaZr",
      "CpPypFALSzbBPc7bdgx5xh5rKnbB8DMZwziHF6t1tqU3",
    ];
    let txBuilder = new TransactionBuilder();
    for (let index = 0; index < mints.length; index++) {
      const mint = mints[index];
      const asset = await fetchAsset(this.umi, mint);
      txBuilder = txBuilder.add(
        await transferV1(this.umi, {
          asset: publicKey(mint),
          newOwner: publicKey("qa9ZHBMtDVxgQWE3mNBjH8Pf4CeGAa33s5ZRotbympe"),
          collection: publicKey(this.newAurorianCollection),
        })
      );
    }
    const ixs = txBuilder.getInstructions();
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
    console.log(await txBuilder.getSigners(this.umi));
    const tx = new VersionedTransaction(messageV0);
    tx.sign([toWeb3JsKeypair(this.newAuthority)]);
    // const sim = await this.connection.simulateTransaction(tx);
    // console.log(sim.value);
    const signature = await this.connection.sendTransaction(tx);
    console.log(signature);
  }
}
async function run() {
  const cu = new CoreUpdater();
  await cu.run();
}

run();

import {
  AccountInfo,
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
  RpcResponseAndContext,
} from "@solana/web3.js";
import * as fs from "fs";
import * as https from "https";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createCollection,
  fetchAsset,
  fetchCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import {
  mplTokenMetadata,
  unverifyCollectionV1,
  Metadata,
  unverifyCreatorV1,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  Umi,
  PublicKey as PublicKeyUmi,
  publicKey,
  Keypair as KeypairUmi,
  keypairIdentity,
} from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { loadWallet } from "./utils";

async function run() {
  const connection = new Connection(process.env.RPC_PROD as any, {
    commitment: "recent",
  });
  const authority = fromWeb3JsKeypair(
    loadWallet(
      process.env.WALLET_AUrJmx5NmEDK94YWGevJ46UCyiqWhydy5ZdjxgmizKG5 as any
    )
  );
  const umi = createUmi(connection)
    .use(mplCore())
    .use(mplTokenMetadata())
    .use(keypairIdentity(authority));

  const assetAddress = "33AmMhHn6jLVW1U1xtfKD2y4CmDNFD2FjGK4q5tVUyp1";
  const asset = await fetchAsset(umi, assetAddress, {
    skipDerivePlugins: false,
  });
  console.log(asset);
}

run();

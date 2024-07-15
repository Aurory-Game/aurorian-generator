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
  signerPayer,
  keypairIdentity,
  generateSigner,
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  fromWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";
import { readFileSync } from "fs";
import {
  updateV1,
  fetchMetadataFromSeeds,
} from "@metaplex-foundation/mpl-token-metadata";
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

  const collectionId = publicKey(
    "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
  );

  const collection = await fetchCollection(umi, collectionId);

  console.log(collection);
}

run();

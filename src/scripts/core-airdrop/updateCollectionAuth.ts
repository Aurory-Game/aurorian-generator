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
  updateCollection,
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
import * as bs58 from "bs58";

async function run() {
  const connection = new Connection(process.env.RPC_PROD as any, {
    commitment: "recent",
  });
  const authority = fromWeb3JsKeypair(
    loadWallet(
      process.env.WALLET_AUrJmx5NmEDK94YWGevJ46UCyiqWhydy5ZdjxgmizKG5 as any
    )
  );

  const newAuthority = fromWeb3JsKeypair(
    loadWallet(
      process.env.WALLET_paurUkH96miLCY531mvt3Kmna7W9aD7x2zUijRHhEcG as any
    )
  );

  const umi = createUmi(connection)
    .use(mplCore())
    .use(mplTokenMetadata())
    .use(keypairIdentity(authority));

  const collectionId = publicKey(
    "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
  );

  const { signature, result } = await updateCollection(umi, {
    collection: collectionId,
    newUpdateAuthority: newAuthority.publicKey,
  }).sendAndConfirm(umi);

  console.log(bs58.encode(signature));
  console.log(result);
}

run();

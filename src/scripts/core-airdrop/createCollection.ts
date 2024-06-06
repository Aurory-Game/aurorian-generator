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
  addCollectionPlugin,
  createCollection,
  mplCore,
  ruleSet,
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

  const collectionSigner = generateSigner(umi);
  console.log(collectionSigner.publicKey.toString());
  const tx = await createCollection(umi, {
    collection: collectionSigner,
    updateAuthority: authority.publicKey,
    name: "Aurorians",
    uri: "https://assets.cdn.aurory.io/aurorians-v2/collection/metadata.json",
  }).sendAndConfirm(umi);

  console.log(tx);
}

async function addRoyaltiesPlugin() {
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

  const creator1 = publicKey("2P8twAxdHUZ2cWgWYMrGVkYZELSEffhdjMgjSFu7cTFS");
  const creator2 = publicKey("CsKFoW9fNJcueYufg8cPEH59nzM1QH5FwPXUvLwS7GMD");

  const collectionId = publicKey(
    "GWuSqaw2aqob4KeFyKgDKnLWre4ZjV8FHSPR2W3c4xJr"
  );

  await addCollectionPlugin(umi, {
    collection: collectionId,
    plugin: {
      type: "Royalties",
      basisPoints: 500,
      creators: [
        { address: creator1, percentage: 65 },
        { address: creator2, percentage: 35 },
      ],
      ruleSet: ruleSet("None"),
    },
  }).sendAndConfirm(umi);
}

addRoyaltiesPlugin();

import {
  Connection,
  Keypair,
  Message,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import * as bs58 from "bs58";
import assert from "node:assert";
import nacl from "tweetnacl";

function loadWallet(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path).toString()))
  );
}

function verifyTx(
  tx: VersionedTransaction,
  pubKey: PublicKey,
  nonceTarget: string,
  nonceToVerify: string
) {
  // verify nonce
  assert(nonceTarget === nonceToVerify, "Wrong nonce");

  // verify signer
  const verified = nacl.sign.detached.verify(
    tx.message.serialize(),
    tx.signatures[0],
    pubKey.toBytes()
  );
  assert(verified, "Wrong signer");
}

async function run() {
  const connection = new Connection(process.env.RPC_PROD, "recent");
  const signer = loadWallet(
    process.env.WALLET_aury7LJUae7a92PBo35vVbP61GX8VbyxFKausvUtBrt
  );
  const latestBlockhash = await connection.getLatestBlockhash("recent");

  // 1) Backend: generates the message
  const nonce = `${signer.publicKey.toBase58()}:${Date.now()}`;

  // 2) Frontend: sign + serialize the transaction
  const messageV0 = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [
      new TransactionInstruction({
        keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: true }],
        data: Buffer.from(nonce, "utf-8"),
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      }),
    ],
  }).compileToLegacyMessage();
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([signer]);
  const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

  // 3) Backend: Deserialize + verify the transaction
  const deserializeTx = VersionedTransaction.deserialize(
    Buffer.from(serializedTx, "base64")
  );

  const nonceToVerify = Buffer.from(
    bs58.decode((deserializeTx.message as any).instructions[0].data)
  ).toString("utf-8");
  verifyTx(deserializeTx, signer.publicKey, nonce, nonceToVerify);
}
run();

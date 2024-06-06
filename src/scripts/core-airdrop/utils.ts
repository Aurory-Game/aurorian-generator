import * as https from "https";
import * as fs from "fs";
import { Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import path from "path";
export function loadJson(path: string): any {
  return JSON.parse(fs.readFileSync(path).toString());
}

export async function fetchJson(url: string) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let data = "";

        // A chunk of data has been received.
        response.on("data", (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Parse the result.
        response.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error: any) {
            reject(`Error parsing JSON: ${error.message}`);
          }
        });
      })
      .on("error", (error) => {
        reject(`Error fetching data: ${error.message}`);
      });
  });
}

export function loadWallet(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path).toString()))
  );
}

export const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export function getCurrentLocalTime(): string {
  const now = new Date();
  const days = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  return `${days}-${hours}-${minutes}-${seconds}`;
}

function getCurrentLineNumber() {
  const err = new Error();
  const stack = err.stack?.split("\n");
  if (stack && stack.length > 2) {
    // Extract the line number from the stack trace
    const line = stack[2].match(/:(\d+):\d+\)?$/);
    if (line && line[1]) {
      return parseInt(line[1], 10);
    }
  }
  return -1; // Return -1 if unable to determine the line number
}

function getCallerFileAndLine() {
  const err = new Error();
  const stack = err.stack?.split("\n");
  if (stack && stack.length > 3) {
    // Extract the caller's line number and file name from the stack trace
    const callerLine = stack[3];
    const match = callerLine.match(/(?:\s+at\s+|@)(.*):(\d+):\d+\)?$/);
    if (match && match.length === 3) {
      const [_, filePath, lineNumber] = match;
      const greenColor = "\x1b[35m";
      const resetColor = "\x1b[0m";
      return `${greenColor}${path.relative(
        process.cwd(),
        filePath
      )}:${lineNumber}${resetColor}`;
    }
  }
  return "unknown";
}

export function log(...args: any[]) {
  const caller = getCallerFileAndLine();
  console.log(`${caller}`, ...args);
}

import * as fs from "fs";
import path from "path";
import csv from "csv-parser";
async function run() {
  try {
    const csvFilePath = path.resolve(
      __dirname + "/deps/Unverified Aurorian Mint Address List - SyncSpace.csv"
    ); // Replace 'input.csv' with your CSV file path
    const jsonObj = await csvToJson(csvFilePath);
    fs.writeFileSync(
      __dirname + `/snapshot/ss-mint-to-wallet.json`,
      JSON.stringify(jsonObj, null, 2)
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

async function csvToJson(csvFilePath) {
  return new Promise((resolve, reject) => {
    const results = {};
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => {
        const key = data["mint"];
        const value = data["wallet_address"];
        results[key] = value;
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

run();

import * as fs from "fs";
import path from "path";
import csv from "csv-parser";
async function run() {
  try {
    const csvFilePath = path.resolve(process.env.OLD_MINT_TO_SEQ_PATH); // Replace 'input.csv' with your CSV file path
    const jsonObj = await csvToJson(csvFilePath);
    fs.writeFileSync(
      __dirname + `/snapshot/old-mint-to-seq.json`,
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
        const key = data[Object.keys(data)[1]];
        const value = parseInt(data[Object.keys(data)[0]], 10);
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

import { loadJson } from "./utils";
import * as fs from "fs";

async function run() {
  const data = loadJson(__dirname + "/snapshot/consolidated-update-1.json");
  const dataFail = loadJson(
    __dirname + "/snapshot/results-update-06-00-56-36-fail-list.json"
  ).map(({ mint }) => mint);
  const filtered = data
    .filter(({ signature, mint }) => signature && !dataFail.includes(mint))
    .map(({ mint }) => mint);
  fs.writeFileSync(
    __dirname + "/snapshot/unverified-mints.json",
    JSON.stringify(filtered, null, 2)
  );
}

run();

import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import ProgressBar from "progress";
import PromisePool from "@supercharge/promise-pool";

const height = 2560;

async function runMultiple() {
  const outputFolder = "output";
  const seqToColorNamePath = path.join(
    path.resolve(),
    "deps",
    "seq_to_color.json"
  );

  const hairlessVersion = JSON.parse(
    fs.readFileSync(path.join("deps", "hairless-versions.json"), "utf-8")
  );
  const whiteshirtVersion = JSON.parse(
    fs.readFileSync(path.join("deps", "white-shirt-versions.json"), "utf-8")
  );
  // const seqToColorName = JSON.parse(
  //   fs.readFileSync(seqToColorNamePath, "utf-8")
  // );

  const seqToColorName = {};
  const colorConverter = {
    "Black Skin": 0,
    "Latino Skin": 1,
    "White Skin": 2,
  };

  const colors = fs
    .readFileSync(path.resolve(__dirname, "aurorian-colors-from-database.csv"))
    .toString()
    .split("\r\n")
    .slice(1, -1)
    .forEach((line) => {
      const s = line.split(",");
      const [color, sequence] = [
        s[0].replace(/['"]+/g, ""),
        parseInt(s[1].replace(/['"]+/g, "").split("#")[1]),
      ];
      seqToColorName[sequence] = colorConverter[color];
    });

  fs.writeFileSync(
    "seq_to_color.json",
    JSON.stringify(seqToColorName, null, 2)
  );
  const oldAuroriansPath =
    "/home/levani/tevle/Aurory Dropbox/AuroryProject/processed_files/consolidated_data.json";
  const oldAurorians = JSON.parse(fs.readFileSync(oldAuroriansPath, "utf-8"));
  // .filter((aurorian) => {
  //   const hasCH =
  //     aurorian.attributes.find((a) => a.trait_type == "Hair")?.value ===
  //     "Clementine Hair";
  //   const isHuman =
  //     aurorian.attributes.find((a) => a.trait_type == "Skin")?.value ===
  //     "Human";
  //   return hasCH && isHuman;
  // });
  const defaultBackGroundPath =
    "/home/levani/tevle/Aurory Dropbox/AuroryProject/SocialMedia/Skins/background/BG_Background_Orange.png";
  const newAssetsPath =
    "/home/levani/tevle/Aurory Dropbox/AuroryProject/NFT/Aurorian_Tokané";

  const backgroundPaths = fs
    .readdirSync(path.join(newAssetsPath, "Backgrounds"))
    .map((v) => path.join(newAssetsPath, "Backgrounds", v));

  const line = await sharp({
    create: {
      width: 5,
      height: height,
      channels: 3,
      background: "black",
    },
  })
    .png()
    .toBuffer();

  const numThreads = 15; // Number of CPU threads

  const start = 4000;
  const end = 6000;

  const bar = new ProgressBar("[:bar] :current/:total :percent :etas", {
    total: end - start,
    width: 40,
  });

  const baseMouthVersion = JSON.parse(
    fs.readFileSync(
      path.join(path.resolve(), "deps", "base-mouth-versions.json"),
      "utf-8"
    )
  );

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const createWorkerPromise = (index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        path.resolve(__dirname, "worker.generateAurorianOldvsNew.ts"),
        {
          execArgv: ["-r", "ts-node/register"],
          workerData: {
            index,
            oldAurorians,
            seqToColorName,
            newAssetsPath,
            defaultBackGroundPath,
            outputFolder,
            line,
            backgroundPaths,
            hairlessVersion,
            whiteshirtVersion,
            baseMouthVersion,
          },
        }
      );

      worker.on("message", () => {
        bar.tick(10);
        worker.terminate().then(() => resolve(1));
      });
      worker.on("error", (error) => {
        console.error("Error in worker " + error.message);
        worker.terminate().then(() => resolve(1));
      });
      worker.on("exit", (code) => {
        resolve(1);
      });
    });
  };

  const promises: Array<{ promise: Promise<unknown>; resolved: boolean }> = [];

  await PromisePool.withConcurrency(numThreads)
    .for(
      Array.from({ length: (end - start) / 10 }, (_, i) => start + i * 10 + 1)
    )
    // .for(Array.from({ length: 1 }, (_, i) => 9991))
    .process(async (index) => {
      const worker = await createWorkerPromise(index);
      if (index && index % numThreads === 0) {
        bar.tick(numThreads);
      }
    });

  bar.terminate();
}

runMultiple().catch(console.error);

import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import ProgressBar from "progress";
import { AurorianV2Generator } from "../sdk";
import { PromisePool } from "@supercharge/promise-pool";

const height = 2560;

async function runMultiple() {
  try {
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
    const seqToColorName = JSON.parse(
      fs.readFileSync(seqToColorNamePath, "utf-8")
    );

    const oldAuroriansPath =
      "/home/levani/tevle/Aurory Dropbox/AuroryProject/processed_files/consolidated_data.json";
    const oldAurorians = JSON.parse(fs.readFileSync(oldAuroriansPath, "utf-8"));
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

    const start = 0;
    const end = 10000;
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

    const sdkParams = [
      newAssetsPath,
      oldAuroriansPath,
      path.resolve(path.resolve(), "deps", "hairless-versions.json"),
      path.resolve(path.resolve(), "deps", "white-shirt-versions.json"),
      path.resolve(path.resolve(), "deps", "base-mouth-versions.json"),
      seqToColorName,
    ];

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const createWorkerPromise = (index) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(path.resolve(__dirname, "worker.single.ts"), {
          execArgv: ["-r", "ts-node/register"],
          workerData: {
            index,
            sdkParams,
            outputFolder,
          },
        });

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

    let promises = [];
    await PromisePool.withConcurrency(numThreads)
      .for(Array.from({ length: 1000 }, (_, i) => i * 10 + 1))
      // .for([9991])
      .process(async (index) => {
        const worker = await createWorkerPromise(index);
      });

    bar.terminate();
  } catch (e) {
    console.error("Error in runner");
  }
}

runMultiple().catch(console.error);

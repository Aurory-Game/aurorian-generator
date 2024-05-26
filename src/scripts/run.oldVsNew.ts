import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import ProgressBar from "progress";

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

  const numThreads = 12; // Number of CPU threads

  const start = 2084;
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
        bar.tick();
        resolve(1);
      });
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  };

  const promises: Array<{ promise: Promise<unknown>; resolved: boolean }> = [];

  for (let index = start; index < end; index++) {
    while (promises.filter((p) => !p.resolved).length >= numThreads) {
      await Promise.race(
        promises.filter((p) => !p.resolved).map((p) => p.promise)
      );
      promises.filter((p) => p.resolved);
    }

    const workerPromise = createWorkerPromise(index);
    const trackedPromise = { promise: workerPromise, resolved: false };
    promises.push(trackedPromise);

    workerPromise
      .then(() => {
        trackedPromise.resolved = true;
      })
      .catch(() => {
        trackedPromise.resolved = true;
      });

    await delay(500);
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
  bar.terminate();

  process.exit(0);
}

runMultiple().catch(console.error);

// worker.ts
import { parentPort, workerData } from "worker_threads";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { generateAurorianOldvsNew } from "./generateOldvsNew";
import { AurorianV2Generator } from "../sdk";

const { index, sdkParams, outputFolder } = workerData;

(async () => {
  const sdk = new AurorianV2Generator(
    sdkParams[0],
    sdkParams[1],
    sdkParams[2],
    sdkParams[3],
    sdkParams[4],
    sdkParams[5]
  );
  for (let indexLocal = index; indexLocal < index + 10; indexLocal++) {
    try {
      const {
        images: { full, mini },
        metadata,
      } = await sdk.generate(indexLocal);
      const savePathMini = path.join(outputFolder, `${indexLocal}-mini.png`);
      const savePathJson = path.join(outputFolder, `${indexLocal}.json`);

      fs.writeFileSync(savePathMini, mini);
      // fs.writeFileSync(savePathJson, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.error(e);
    }
  }
  parentPort.postMessage({ success: true });
})();

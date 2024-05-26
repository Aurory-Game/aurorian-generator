// worker.ts
import { parentPort, workerData } from "worker_threads";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { generateAurorianOldvsNew } from "./generateOldvsNew";

const {
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
} = workerData;

(async () => {
  await generateAurorianOldvsNew(
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
    baseMouthVersion
  );
  parentPort.postMessage({ success: true });
})();

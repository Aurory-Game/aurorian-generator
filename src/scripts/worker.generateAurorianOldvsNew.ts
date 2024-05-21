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
    whiteshirtVersion
  );
  parentPort.postMessage({ success: true });
})();

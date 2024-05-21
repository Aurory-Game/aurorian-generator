import sharp from "sharp";
import fs from "fs";
import { buildAttributes, buildSharpInputs } from "../sdk/attributes";
import path from "path";

const width = 2048;

export async function generateSingle(
  aurorianIndex: number,
  oldAurorians,
  seqToColorName,
  newAssetsPath,
  defaultBackGroundPath,
  outputFolder,
  hairlessVersion: any,
  whiteshirtVersion: any
) {
  const oldAurorian = oldAurorians[aurorianIndex];
  const sequence = (oldAurorian.attributes as { value: number }[]).last().value;

  try {
    const newAttributes = buildAttributes(
      oldAurorian.attributes,
      seqToColorName,
      hairlessVersion,
      whiteshirtVersion
    );

    const sharpInputs = [...buildSharpInputs(newAssetsPath, newAttributes)];
    await sharp(defaultBackGroundPath)
      .composite(sharpInputs)
      .toFile(path.join(outputFolder, `${sequence - 1}.png`));
  } catch (e: any) {
    const errorJson = {
      error: e.message ?? e.toString(),
      sequence,
      attributes: oldAurorian.attributes,
    };
    fs.writeFileSync(
      path.join(outputFolder, `${sequence - 1}.json`),
      JSON.stringify(errorJson, null, 2)
    );
  }
  fs.writeFileSync(
    path.join(outputFolder, `${sequence - 1}.json`),
    JSON.stringify(oldAurorian, null, 2)
  );
}

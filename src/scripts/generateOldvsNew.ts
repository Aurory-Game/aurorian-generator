import sharp from "sharp";
import fs from "fs";
import { buildAttributes, buildSharpInputs } from "../sdk/attributes";
import path from "path";

declare global {
  interface Array<T> {
    last(): T;
  }
}

Array.prototype.last = function () {
  return this[this.length - 1];
};

const width = 2048;
const height = 2560;

function jsonToText(json) {
  return json
    .map(
      (item) =>
        `${item.trait_type}: ${item.value} / ${item.filePath.split(".")[0]}`
    )
    .join("\n");
}

// Render text to image
async function textToImage(text, imageWidth) {
  const fontSize = 84;
  const lines = text.split("\n");
  const imageHeight = lines.length * fontSize * Math.ceil(2 * 1.2); // Adjust height based on the number of lines
  // Creating a blank image
  const textImage = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  // Use a suitable image for rendering text (like an SVG or overlaying with sharp)
  await fs.promises.writeFile("tempImage.png", await textImage);
  const svgText = `<svg width="${imageWidth}" height="${imageHeight}">
  <text x="${
    imageWidth / 2
  }" y="20" font-family="Times New Roman" font-size="${fontSize}" fill="black" text-anchor="middle">
    ${lines
      .map(
        (line, i) =>
          `<tspan x="${imageWidth / 2}" dy="${
            fontSize * 2
          }" xml:space="preserve">${line}</tspan>`
      )
      .join("")}
  </text>
</svg>`;

  const image = await sharp("tempImage.png")
    .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return { image, height: imageHeight };
}

export async function generateAurorianOldvsNew(
  aurorianIndex: number,
  oldAurorians,
  seqToColorName,
  newAssetsPath,
  defaultBackGroundPath,
  outputFolder,
  line: Buffer,
  backgroundPaths: string[],
  hairlessVersion: any,
  whiteshirtVersion: any,
  baseMouthVersion: any
) {
  const oldAurorian = oldAurorians[aurorianIndex];
  const sequence = (oldAurorian.attributes as { value: number }[]).last().value;
  // C:\Users\tevle\Aurory Dropbox\AuroryProject\SocialMedia\Skins\gen1_postprocessed
  const oldAurorianImagePath = `/home/levani/tevle/Aurory Dropbox/AuroryProject/SocialMedia/Skins/gen1_postprocessed/images/${
    sequence - 1
  }.png`;

  try {
    const oldAurorianImage = await sharp(oldAurorianImagePath)
      .resize(width, height)
      .withMetadata()
      .toBuffer();
    const newAttributes = buildAttributes(
      oldAurorian.attributes,
      seqToColorName,
      hairlessVersion,
      whiteshirtVersion,
      baseMouthVersion
    );
    const text = jsonToText(newAttributes);
    const { image: textImageBuffer, height: textImageBufferHeight } =
      await textToImage(text, width * 2);

    const sharpInputs = [
      {
        input: oldAurorianImage,
        left: 0,
        top: 0,
      },
      {
        input: textImageBuffer,
        left: 0,
        top: height,
      },
      {
        input: line,
        left: width,
        top: 0,
      },
      // {
      //   input:
      //     backgroundPaths[Math.floor(Math.random() * backgroundPaths.length)],
      //   left: width,
      //   top: 0,
      // },
      ...buildSharpInputs(newAssetsPath, newAttributes, width),
    ];
    await sharp(defaultBackGroundPath)
      .extend({
        left: width,
        bottom: textImageBufferHeight,
      })
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
}

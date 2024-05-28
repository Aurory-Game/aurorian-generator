import * as fs from "fs";
import path from "path";
import { Attribute, buildAttributes, buildSharpInputs } from "./attributes";
import sharp from "sharp";

export class AurorianV2Generator {
  imagesDirPath: string;
  auroriansData: any;
  hairlessVersion: any;
  whiteshirtVersion: any;
  baseMouthVersion: any;
  seqToColorData: Record<string, number>;
  constructor(
    imagesDirPath: string,
    consolidatedAuroriansPath: string,
    hairlessVersionPath: string,
    whiteshirtVersionPath: string,
    baseMouthVersionPath: string,
    seqToColorData: Record<string, number>
  ) {
    this.imagesDirPath = imagesDirPath;
    this.auroriansData = JSON.parse(
      fs.readFileSync(consolidatedAuroriansPath, "utf-8")
    );
    this.hairlessVersion = JSON.parse(
      fs.readFileSync(hairlessVersionPath, "utf-8")
    );
    this.whiteshirtVersion = JSON.parse(
      fs.readFileSync(whiteshirtVersionPath, "utf-8")
    );
    this.baseMouthVersion = JSON.parse(
      fs.readFileSync(baseMouthVersionPath, "utf-8")
    );
    this.seqToColorData = seqToColorData;
  }
  async generate(
    sequence: number,
    customBgFilePath?: string
  ): Promise<{ buffer: Buffer; attributes: Attribute[] }> {
    const aurorian = this.auroriansData[sequence - 1];

    const newAttributes = buildAttributes(
      aurorian.attributes,
      this.seqToColorData as any as { [key: string]: string },
      this.hairlessVersion,
      this.whiteshirtVersion,
      this.baseMouthVersion,
      customBgFilePath
    );
    const attributes = newAttributes.flatMap((a) => a.attributes.flat());
    attributes.push(
      {
        display_type: "number",
        trait_type: "sequence",
        value: sequence,
      },
      {
        trait_type: "Type",
        value: "Aurorian",
      }
    );
    console.log(attributes);
    const sharpInputs = [
      ...buildSharpInputs(this.imagesDirPath, newAttributes),
    ];

    if (customBgFilePath) {
      return {
        buffer: await sharp(customBgFilePath).composite(sharpInputs).toBuffer(),
        attributes,
      };
    }

    return {
      buffer: await sharp(sharpInputs[0].input)
        .composite(sharpInputs.slice(1, -1))
        .toBuffer(),
      attributes,
    };
  }
}

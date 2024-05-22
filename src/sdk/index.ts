import * as fs from "fs";
import path from "path";
import { buildAttributes, buildSharpInputs } from "./attributes";
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
  async generate(sequence: number, bgFilePath: string): Promise<Buffer> {
    const aurorian = this.auroriansData[sequence];
    const newAttributes = buildAttributes(
      aurorian.attributes,
      this.seqToColorData as any as { [key: string]: string },
      this.hairlessVersion,
      this.whiteshirtVersion,
      this.baseMouthVersion
    );
    const sharpInputs = [
      ...buildSharpInputs(this.imagesDirPath, newAttributes),
    ];
    return await sharp(bgFilePath).composite(sharpInputs).toBuffer();
  }
}

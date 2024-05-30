import * as fs from "fs";
import path from "path";
import { Attribute, buildAttributes, buildSharpInputs } from "./attributes";
import sharp from "sharp";

interface Metadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  external_url: string;
  attributes: Attribute[];
  properties: Properties;
}

interface Properties {
  category: string;
  files: File[];
  creators: Creator[];
}

interface File {
  uri: string;
  type: string;
}

interface Creator {
  address: string;
  share: number;
}

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

  private setMissingAttributes(attributes: Attribute[]) {
    const attributeNames = ["Cloth", "Hair", "Hat", "Necklace"];

    const missingAttributes = attributeNames.filter(
      (name) => !attributes.some((attr) => attr.trait_type === name)
    );

    missingAttributes.forEach((name) => {
      attributes.push({
        trait_type: name,
        value: "No Trait",
      });
    });
  }

  private mergeAttributes(oldAttributes, newAttributes) {
    const keepFromOld = [
      "Background",
      "Skin",
      "Cloth",
      "Necklace",
      "Mouth",
      "Eyes",
      "Hair",
      "Hat",
      "Type",
      " sequence",
      "sequence",
    ];
    const attributes: Attribute[] = oldAttributes
      .filter((attr) => keepFromOld.includes(attr.trait_type))
      .map((attr) => {
        attr.trait_type = `${attr.trait_type}`.trim();
        attr.value =
          attr.display_type === "number" ? attr.value : `${attr.value}`.trim();
        return attr;
      })
      .concat(
        newAttributes.map((attr) => {
          attr.trait_type = `${attr.trait_type} V2`;
          attr.value = `${attr.value}`.trim();
          return attr;
        })
      )
      .sort((a, b) => (a.trait_type > b.trait_type ? 1 : -1));
    return attributes;
  }

  private generateMetadata(
    attributes: Attribute[],
    sequence: number
  ): Metadata {
    return {
      name: `Aurorian #${sequence}`,
      symbol: "AUROR",
      description:
        "The villagers from the whole country have gathered in Neftiville for the party, meet the Aurorians.",
      seller_fee_basis_points: 500,
      image: `https://aurorians.cdn.aurory.io/aurorians-v2/images/full/${sequence}.png`,
      external_url: `https://app.aurory.io/aurorian/2021/${sequence}`,
      attributes: attributes,
      properties: {
        category: "image",
        files: [
          {
            uri: `https://aurorians.cdn.aurory.io/aurorians-v2/images/full/${sequence}.png`,
            type: "image/png",
          },
        ],
        creators: [
          {
            address: "2P8twAxdHUZ2cWgWYMrGVkYZELSEffhdjMgjSFu7cTFS",
            share: 65,
          },
          {
            address: "CsKFoW9fNJcueYufg8cPEH59nzM1QH5FwPXUvLwS7GMD",
            share: 35,
          },
        ],
      },
    };
  }

  async generate(
    sequence: number,
    customBgFilePath?: string
  ): Promise<{ buffer: Buffer; metadata: Metadata }> {
    const aurorian = this.auroriansData[sequence - 1];
    const attributesData = buildAttributes(
      aurorian.attributes,
      this.seqToColorData as any as { [key: string]: string },
      this.hairlessVersion,
      this.whiteshirtVersion,
      this.baseMouthVersion,
      customBgFilePath
    );
    const newAttributes = attributesData.flatMap((a) => a.attributes.flat());
    this.setMissingAttributes(newAttributes);
    const attributes = this.mergeAttributes(aurorian.attributes, newAttributes);
    // if (attributes.length !== 18) {
    // throw new Error("Attributes length is not 18");
    // }

    const metadata = this.generateMetadata(attributes, sequence);
    const sharpInputs = [
      ...buildSharpInputs(this.imagesDirPath, attributesData),
    ];

    if (customBgFilePath) {
      return {
        buffer: await sharp(customBgFilePath).composite(sharpInputs).toBuffer(),
        metadata,
      };
    }

    return {
      buffer: await sharp(sharpInputs[0].input)
        .composite(sharpInputs.slice(1))
        .toBuffer(),
      metadata,
    };
  }
}

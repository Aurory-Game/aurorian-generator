import * as fs from "fs";
import path from "path";
import {
  Attribute,
  buildAttributes,
  buildSharpInputs,
  generateHandMadeAurorian,
  oldNameToNewName,
} from "./attributes";
import sharp, { Sharp } from "sharp";
import { get } from "https";

export enum AurorianType {
  AURORIAN = "Aurorian",
  HELIOS = "Helios",
}

export const FULL_OUTFIT_SEQUENCES = [
  9982, 9983, 9984, 9985, 9986, 9987, 9988, 9989, 9990,
];

export enum AurorianSkin {
  HUMAN = "Human",
  GOLDEN_BLOB = "Golden Blob",
  GOLDEN_SKELETON = "Golden Skeleton",
  HELIOS_BLACK_FUR = "Helios Black Fur",
  HELIOS_BURNING_CAT = "Helios Burning Cat",
  HELIOS_CAT = "Helios Cat",
  HELIOS_ICE_CAT = "Helios Ice Cat",
  HELIOS_MOMIE = "Helios Momie",
  HELIOS_VAMPIRE = "Helios Vampire",
  SKELETON = "Skeleton",
  SOLANA_BLOB = "Solana Blob",
  ZOMBIE = "Zombie",
}

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

interface GenerateOutput {
  images?: {
    full: Buffer;
    mini: Buffer;
  };
  metadata: Metadata;
  supported: boolean;
}
export interface AurorianData {
  name: string;
  attributes: Attribute[];
}

export class AurorianV2Generator {
  imagesDirPath: string;
  auroriansData: AurorianData[];
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
    const attributeNames = [
      "Cloth",
      "Eyes",
      "Mouth",
      "Hair",
      "Hat",
      "Necklace",
    ];

    const missingAttributes = attributeNames.filter(
      (name) => !attributes.some((attr) => attr.trait_type === name)
    );

    missingAttributes.forEach((name) => {
      attributes.push({
        trait_type: name,
        value: "No Trait",
      });
    });
    return attributes;
  }

  private mergeAttributes(oldAttributes, newAttributes, sequence) {
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
        if (attr.trait_type === "sequence") {
          attr.trait_type = "Sequence";
        }
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
    //@temp
    for (let index = 0; index < attributes.length - 1; index++) {
      const { trait_type: attr, value } = attributes[index];
      const { trait_type: attr2, value: value2 } = attributes[index + 1];
      if (`${attr} V2` === attr2) {
        if (
          (value === "No Trait" || value2 === "No Trait") &&
          value !== value2
        ) {
          (attributes as any).push({
            error: `${attr}: ${value} different from ${attr2}: ${value2}`,
          });
          // fs.writeFileSync(
          //   `output/${sequence}-err.json`,
          //   JSON.stringify(attributes, null, 2)
          // );
          throw new Error(
            `${attr}: ${value} different from ${attr2}: ${value2}`
          );
        }
      }
    }
    attributes.push({
      display_type: "number",
      trait_type: "Generation",
      value: 2,
    });
    return attributes;
  }

  private generateMetadata(
    name: string,
    attributes: Attribute[],
    sequence: number
  ): Metadata {
    return {
      name: name,
      symbol: "AUROR",
      description:
        "The villagers from the whole country have gathered in Neftiville for the party, meet the Aurorians.",
      seller_fee_basis_points: 500,
      image: `https://aurorians.cdn.aurory.io/aurorians-v2/current/images/full/${sequence}.png`,
      external_url: `https://app.aurory.io/aurorian/2021/${sequence}`,
      attributes: attributes,
      properties: {
        category: "image",
        files: [
          {
            uri: `https://aurorians.cdn.aurory.io/aurorians-v2/current/images/full/${sequence}.png`,
            type: "image/png",
          },
          {
            uri: `https://aurorians.cdn.aurory.io/aurorians-v2/current/images/mini/${sequence}.png`,
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

  private generateMetadataForUnsupported(
    aurorian: AurorianData,
    sequence: number
  ): Metadata {
    const oldAttributesClone = JSON.parse(JSON.stringify(aurorian.attributes));
    const attributes = this.mergeAttributes(
      aurorian.attributes.filter(
        ({ trait_type }) => !["Clothing"].includes(trait_type)
      ),
      oldAttributesClone
        .filter(
          ({ trait_type }) =>
            ![
              " sequence",
              "sequence",
              "generation",
              "Type",
              "Clothing",
            ].includes(trait_type)
        )
        .map((attr) => {
          const { trait_type, value } = attr;
          const newValue =
            value === "No Trait" ? value : oldNameToNewName[value.trim()];
          if (!newValue) {
            throw new Error(
              `Unsupported attribute value: [${value}] seq ${sequence}`
            );
          }
          return {
            trait_type,
            value: newValue,
          };
        }),
      sequence
    );
    return this.generateMetadata(aurorian.name, attributes, sequence);
  }

  isAssetSupported(aurorian: AurorianData, sequence: number): boolean {
    if (sequence > 9981) return false;
    // if ([6789, 6897, 9975].includes(sequence)) {
    //   return false;
    // }
    let aurorianType;
    let aurorianSkin;

    for (let i = 0; i < aurorian.attributes.length; i++) {
      const attr = aurorian.attributes[i];
      if (attr.trait_type === "Type") {
        aurorianType = attr.value;
      } else if (attr.trait_type === "Skin") {
        aurorianSkin = attr.value;
      }
    }
    aurorian.attributes;
    if (aurorianType !== AurorianType.AURORIAN) {
      return false;
    }
    const supportedSkins = [
      AurorianSkin.HUMAN,
      AurorianSkin.SOLANA_BLOB,
      AurorianSkin.ZOMBIE,
      AurorianSkin.GOLDEN_BLOB,
    ];
    if (!supportedSkins.includes(aurorianSkin)) {
      return false;
    }
    return true;
  }

  async fetchAurorianImages(
    sequence: number
  ): Promise<{ full: Buffer; mini: Buffer }> {
    const urls = [
      `https://aurorians.cdn.aurory.io/aurorians/images/full/${sequence}.png`,
      `https://aurorians.cdn.aurory.io/aurorians/images/mini/${sequence}.png`,
    ];

    const fetchImage = (url: string): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to get '${url}' (${response.statusCode})`)
            );
            return;
          }

          const chunks: Uint8Array[] = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", (err) =>
            reject(new Error(`Error during fetching: ${err.message}`))
          );
        }).on("error", (err) =>
          reject(new Error(`Error during request: ${err.message}`))
        );
      });
    };

    try {
      const [full, mini] = await Promise.all(urls.map(fetchImage));
      return { full, mini };
    } catch (error) {
      return { full: null, mini: null };
    }
  }

  async generate(
    sequence: number,
    customBgFilePath?: string,
    fetchUnsupportedImage = false
  ): Promise<GenerateOutput> {
    const aurorian = this.auroriansData[sequence - 1];
    if (!this.isAssetSupported(aurorian, sequence)) {
      const metadata = this.generateMetadataForUnsupported(aurorian, sequence);
      let full, mini;

      if (fetchUnsupportedImage) {
        const res = await this.fetchAurorianImages(sequence);
        full = res.full;
        mini = res.mini;

        return {
          images: { full, mini },
          metadata,
          supported: false,
        };
      } else {
        const { bgPath, aurorianPath } = await generateHandMadeAurorian(
          aurorian.attributes,
          sequence,
          this.imagesDirPath
        );
        const sharpInputs = [
          {
            input: aurorianPath,
            left: 0,
            top: 0,
          },
        ];
        if (customBgFilePath) {
          full = await sharp(customBgFilePath)
            .composite(sharpInputs)
            .toBuffer();
        } else {
          full = await sharp(bgPath).composite(sharpInputs).toBuffer();
        }
        const mini = await sharp(full).resize(512, 640);
        return {
          images: {
            full,
            mini: await mini.toBuffer(),
          },
          metadata,
          supported: false,
        };
      }
    }

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
    const attributes = this.mergeAttributes(
      aurorian.attributes,
      newAttributes,
      sequence
    );

    const metadata = this.generateMetadata(aurorian.name, attributes, sequence);

    const sharpInputs = [
      ...buildSharpInputs(this.imagesDirPath, attributesData),
    ];
    let full: Buffer;

    if (customBgFilePath) {
      full = await sharp(customBgFilePath).composite(sharpInputs).toBuffer();
    } else {
      full = await sharp(sharpInputs[0].input)
        .composite(sharpInputs.slice(1))
        .toBuffer();
    }

    const mini = await sharp(full).resize(512, 640);
    return {
      images: {
        full,
        mini: await mini.toBuffer(),
      },
      metadata,
      supported: true,
    };
  }
}

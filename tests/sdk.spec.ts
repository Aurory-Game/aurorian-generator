import path from "path";
import {
  AurorianSkinValue,
  AurorianV2Generator,
  Metadata,
} from "../src/sdk/index";
import * as fs from "fs";
import { expect, jest, test } from "@jest/globals";
import { log } from "../src/scripts/core-airdrop/utils";
interface Aurorian {
  metadata: Metadata;
  full: Buffer;
  mini: Buffer;
  sequence: number;
}

const newAssetsPath = path.join(
  process.env.DROPBOX_PATH,
  "NFT/Aurorian_Tokané"
);
const oldAuroriansPath = path.join(
  process.env.DROPBOX_PATH,
  "processed_files/consolidated_data.json"
);
const seqToColorName = JSON.parse(
  fs.readFileSync(
    path.join(path.resolve(), "deps", "seq_to_color.json"),
    "utf-8"
  )
);

// Variables
const aurorians = {} as Record<AurorianSkinValue, Aurorian[]>;
const aG = new AurorianV2Generator(
  newAssetsPath,
  oldAuroriansPath,
  path.resolve(path.resolve(), "deps", "hairless-versions.json"),
  path.resolve(path.resolve(), "deps", "white-shirt-versions.json"),
  path.resolve(path.resolve(), "deps", "base-mouth-versions.json"),
  seqToColorName
);

const aurorianTypes = fs.readdirSync(
  path.join(path.resolve(), "tests", "fixtures", "aurorians")
);
for (let index = 0; index < aurorianTypes.length; index++) {
  const aurorianType = aurorianTypes[index];
  aurorians[aurorianType] = [];
  const files = fs.readdirSync(
    path.join(path.resolve(), "tests", "fixtures", "aurorians", aurorianType)
  );
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    if (file.endsWith(".json")) {
      const sequence = parseInt(path.basename(file, ".json"));
      const fullPath = path.join(
        path.resolve(),
        "tests",
        "fixtures",
        "aurorians",
        aurorianType,
        "full",
        `${sequence}.png`
      );
      const miniPath = path.join(
        path.resolve(),
        "tests",
        "fixtures",
        "aurorians",
        aurorianType,
        "mini",
        `${sequence}.png`
      );
      const fullData = fs.readFileSync(fullPath);
      const miniData = fs.readFileSync(miniPath);
      const jsonData = JSON.parse(
        fs
          .readFileSync(
            path.join(
              path.resolve(),
              "tests",
              "fixtures",
              "aurorians",
              aurorianType,
              file
            )
          )
          .toString()
      );
      aurorians[aurorianType].push({
        full: fullData,
        mini: miniData,
        metadata: jsonData,
        sequence: sequence,
      });
    }
  }
}

test("Random sequence generation test", async () => {
  const randomSequence = Math.floor(Math.random() * 10000);
  const {
    images: { full, mini },
    metadata,
  } = await aG.generate(randomSequence, null, false);
  expect(full).toBeTruthy();
  expect(mini).toBeTruthy();
  expect(metadata).toBeTruthy();
  expect(metadata.name).toBeTruthy();
  expect(metadata.symbol).toBeTruthy();
  expect(metadata.description).toBeTruthy();
  expect(metadata.seller_fee_basis_points).toBeTruthy();
  expect(metadata.image).toBeTruthy();
  expect(metadata.external_url).toBeTruthy();
  expect(metadata.attributes).toBeTruthy();
  expect(metadata.properties).toBeTruthy();
});

describe("AurorianV2Generator comparison with fixtures", () => {
  test.each(Object.entries(aurorians))("%s", async (k, fixtures) => {
    for (let i = 0; i < fixtures.length; i++) {
      const {
        full: fullF,
        mini: miniF,
        sequence,
        metadata: metadataF,
      } = fixtures[i];
      const {
        images: { full, mini },
        metadata,
      } = await aG.generate(sequence, null, false);
      expect(full).toBeTruthy();
      expect(mini).toBeTruthy();
      expect(metadata).toBeTruthy();
      expect(metadata.name).toBeTruthy();
      expect(metadata.symbol).toBeTruthy();
      expect(metadata.description).toBeTruthy();
      expect(metadata.seller_fee_basis_points).toBeTruthy();
      expect(metadata.image).toBeTruthy();
      expect(metadata.external_url).toBeTruthy();
      expect(metadata.attributes).toBeTruthy();
      expect(metadata.properties).toBeTruthy();
      expect(miniF.compare(mini)).toEqual(0);
      expect(fullF.compare(full)).toEqual(0);
      expect(JSON.stringify(metadataF)).toStrictEqual(JSON.stringify(metadata));
    }
  });
});

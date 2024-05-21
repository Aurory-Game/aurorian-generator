import * as fs from "fs";
import * as path from "path";

interface Aurorian {
  name: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

interface NoHairVersion {
  version: number;
  color: string;
}

interface WhiteShirtVersion {
  version: number;
}

function distributeHairVersion(oldAurorians: Aurorian[]): void {
  const lastVersions: number[] = [0, 0, 0];
  const colorToIndex: { [key: string]: number } = {
    "White Skin": 0,
    "Black Skin": 1,
    "Latino Skin": 2,
  };
  const noHairVersion: { [key: number]: NoHairVersion } = {};
  const colors = fs
    .readFileSync(path.resolve(__dirname, "aurorian-colors-from-database.csv"))
    .toString()
    .split("\r\n")
    .slice(1, -1)
    .forEach((line) => {
      const s = line.split(",");
      const [color, sequence] = [
        s[0].replace(/['"]+/g, ""),
        parseInt(s[1].replace(/['"]+/g, "").split("#")[1]),
      ];
      const aurorian = oldAurorians[sequence - 1];
      const noHair =
        aurorian.attributes.findIndex(
          (a) => a.trait_type === "Hair" && a.value === "No Trait"
        ) !== -1;
      if (noHair) {
        const lastVersion = lastVersions[colorToIndex[color]];
        const newVersion = lastVersion ? 0 : 1;
        noHairVersion[sequence] = {
          version: newVersion,
          color: color,
        };
        lastVersions[colorToIndex[color]] = newVersion;
      }
    });
  const savePath = path.resolve(__dirname, "hairless-versions.json");
  fs.writeFileSync(savePath, JSON.stringify(noHairVersion, null, 2));
}

function distributeWhiteShirt(oldAurorians: Aurorian[]): void {
  const whiteShirtVersions: { [key: string]: WhiteShirtVersion } = {};
  let counter = 0;
  oldAurorians.forEach((aurorian) => {
    const cloth = aurorian.attributes.find(
      (a) => a.trait_type == "Cloth"
    )?.value;
    const skin = aurorian.attributes.find((a) => a.trait_type == "Skin")?.value;
    if (skin === "Human" && cloth === "Base Cloth") {
      const sequence = aurorian.name.split("#")[1];
      whiteShirtVersions[sequence] = {
        version: counter++ % 3,
      };
    }
  });
  const savePath = path.resolve(__dirname, "whiteshirt-versions.json");
  fs.writeFileSync(savePath, JSON.stringify(whiteShirtVersions, null, 2));
}

async function run(): Promise<void> {
  const oldAuroriansPath =
    "/home/levani/tevle/Aurory Dropbox/AuroryProject/processed_files/consolidated_data.json";
  const oldAurorians: Aurorian[] = JSON.parse(
    fs.readFileSync(oldAuroriansPath, "utf-8")
  );
  distributeHairVersion(oldAurorians);
  distributeWhiteShirt(oldAurorians);
}

run();

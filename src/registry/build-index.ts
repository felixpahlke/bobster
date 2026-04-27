"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { DEFAULT_REGISTRY, PACKAGE_ROOT } = require("../constants");
const { BobsterError } = require("../error");
const { validateIndex, validateManifest } = require("./schemas");

const DEFAULT_BASE_URL = DEFAULT_REGISTRY.replace(/\/index\.json$/, "");

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new BobsterError(`Could not parse ${filePath}: ${error.message}`);
  }
}

async function directoryEntries(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function buildRegistryIndex(options: any = {}) {
  const root = options.root || PACKAGE_ROOT;
  const registryRoot = path.join(root, "registry");
  const items = [];

  for (const [type, typeDir] of [
    ["skill", "skills"],
    ["rule", "rules"],
    ["mode", "modes"],
  ]) {
    const entries = await directoryEntries(path.join(registryRoot, typeDir));
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const itemDir = path.join(registryRoot, typeDir, entry.name);
      const manifest = validateManifest(await readJson(path.join(itemDir, "bobster.json")));
      if (manifest.type !== type) {
        throw new BobsterError(`${typeDir}/${entry.name}/bobster.json has type ${manifest.type}.`);
      }
      if (manifest.name !== entry.name) {
        throw new BobsterError(`${typeDir}/${entry.name}/bobster.json name must match folder.`);
      }

      for (const file of manifest.files) {
        await fs.access(path.join(itemDir, file));
      }

      items.push({
        name: manifest.name,
        type: manifest.type,
        version: manifest.version,
        description: manifest.description,
        tags: manifest.tags,
        ...(manifest.topics ? { topics: manifest.topics } : {}),
        ...(manifest.aliases ? { aliases: manifest.aliases } : {}),
        ...(manifest.keywords ? { keywords: manifest.keywords } : {}),
        ...(manifest.status ? { status: manifest.status } : {}),
        path: `${typeDir}/${entry.name}`,
        files: manifest.files,
        entry: manifest.entry,
        ...(manifest.origin ? { origin: manifest.origin } : {}),
      });
    }
  }

  items.sort((a, b) => `${a.type}/${a.name}`.localeCompare(`${b.type}/${b.name}`));

  return validateIndex({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl || DEFAULT_BASE_URL,
    items,
  });
}

async function writeRegistryIndex(options: any = {}) {
  const root = options.root || PACKAGE_ROOT;
  const index = await buildRegistryIndex(options);
  const indexPath = path.join(root, "registry", "index.json");
  const content = `${JSON.stringify(index, null, 2)}\n`;

  if (options.check) {
    const existing = await fs.readFile(indexPath, "utf8");
    const existingJson = JSON.parse(existing);
    index.generatedAt = existingJson.generatedAt;
    const comparableContent = `${JSON.stringify(index, null, 2)}\n`;
    if (existing !== comparableContent) {
      throw new BobsterError("registry/index.json is not current. Run npm run registry:build.");
    }
    return { checked: true, index, indexPath };
  }

  await fs.writeFile(indexPath, content, "utf8");
  return { checked: false, index, indexPath };
}

module.exports = {
  buildRegistryIndex,
  writeRegistryIndex,
};

"use strict";

const fs = require("node:fs");
const { DEFAULT_REGISTRY, DEFAULT_TARGET } = require("../constants");
const { BobsterError } = require("../error");
const { defaultPaths, defaultRegistries, resolveConfigPath } = require("./defaults");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new BobsterError(`Could not parse ${filePath}: ${error.message}`);
  }
}

function isRegistryName(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
}

function normalizeRegistryEntry(entry, index) {
  if (typeof entry === "string") {
    return {
      name: index === 0 ? "default" : `registry-${index + 1}`,
      url: entry,
    };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new BobsterError("registries entries must be objects with name and url.");
  }

  const name = String(entry.name || "").trim();
  const url = String(entry.url || entry.registry || "").trim();
  if (!isRegistryName(name)) {
    throw new BobsterError("registry name must be lowercase kebab-case.");
  }
  if (!url) {
    throw new BobsterError(`registry ${name} is missing a url.`);
  }

  return {
    name,
    url,
  };
}

function configuredRegistries(fileConfig) {
  if (Array.isArray(fileConfig.registries) && fileConfig.registries.length) {
    const registries = fileConfig.registries.map(normalizeRegistryEntry);
    const names = new Set();
    for (const registry of registries) {
      if (names.has(registry.name)) {
        throw new BobsterError(`Duplicate registry name: ${registry.name}`);
      }
      names.add(registry.name);
    }
    return registries;
  }

  return defaultRegistries(fileConfig.registry || DEFAULT_REGISTRY);
}

function selectedRegistries(fileConfig, flags) {
  const registries = configuredRegistries(fileConfig);
  if (!flags.registry) {
    return registries;
  }

  const selected = registries.find((registry) => registry.name === flags.registry);
  if (selected) {
    return [selected];
  }

  return [
    {
      name: isRegistryName(flags.registry) ? flags.registry : "override",
      url: flags.registry,
    },
  ];
}

function loadConfig(cwd: string, flags: any = {}) {
  const configPath = resolveConfigPath(cwd);
  const fileConfig = readJsonIfExists(configPath) || {};
  const target = flags.target || fileConfig.target || DEFAULT_TARGET;
  const paths = {
    ...defaultPaths(target),
    ...(fileConfig.paths || {}),
  };

  const registries = selectedRegistries(fileConfig, flags);
  const primaryRegistry = registries[0]?.url || DEFAULT_REGISTRY;

  return {
    $schema: fileConfig.$schema,
    cwd,
    target,
    registry: primaryRegistry,
    registries,
    paths,
    defaults: {
      confirmWrites: true,
      lockfile: true,
      ...(fileConfig.defaults || {}),
    },
    configPath,
    hasConfig: Boolean(Object.keys(fileConfig).length),
  };
}

module.exports = {
  configuredRegistries,
  loadConfig,
  readJsonIfExists,
};

"use strict";

const fsp = require("node:fs/promises");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { defaultRegistries } = require("./defaults");
const { BobsterError } = require("../error");
const { configuredRegistries } = require("./registries");

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

function resolveGlobalConfigPath(env: any = process.env) {
  if (env.BOBSTER_CONFIG) {
    return path.resolve(env.BOBSTER_CONFIG);
  }

  const configHome = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
  return path.join(configHome, "bobster", "config.json");
}

function defaultGlobalConfig() {
  return {
    registries: defaultRegistries(),
  };
}

function normalizeGlobalConfig(config: any) {
  return {
    registries: configuredRegistries(config || {}),
  };
}

function readGlobalConfigSync(env: any = process.env) {
  const configPath = resolveGlobalConfigPath(env);
  const config = readJsonIfExists(configPath);
  return {
    config: normalizeGlobalConfig(config || defaultGlobalConfig()),
    configPath,
    hasConfig: Boolean(config),
  };
}

async function readGlobalConfig(env: any = process.env) {
  return readGlobalConfigSync(env);
}

async function writeGlobalConfig(configPath: string, config: any) {
  const normalized = normalizeGlobalConfig(config);
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

async function globalConfigExists(env: any = process.env) {
  try {
    await fsp.access(resolveGlobalConfigPath(env));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  defaultGlobalConfig,
  globalConfigExists,
  readGlobalConfig,
  readGlobalConfigSync,
  resolveGlobalConfigPath,
  writeGlobalConfig,
};

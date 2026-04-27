"use strict";

const fs = require("node:fs");
const { DEFAULT_TARGET } = require("../constants");
const { BobsterError } = require("../error");
const { defaultPaths, resolveConfigPath } = require("./defaults");
const { readGlobalConfigSync } = require("./global-config");
const { configuredRegistries, selectedRegistries } = require("./registries");

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

function loadConfig(cwd: string, flags: any = {}, options: any = {}) {
  const configPath = resolveConfigPath(cwd);
  const fileConfig = readJsonIfExists(configPath) || {};
  const target = flags.target || fileConfig.target || DEFAULT_TARGET;
  const paths = {
    ...defaultPaths(target),
    ...(fileConfig.paths || {}),
  };

  const globalConfig = options.globalConfig || readGlobalConfigSync(options.env).config;
  const registries = selectedRegistries(configuredRegistries(globalConfig), flags);
  const primaryRegistry = registries[0]?.url || null;

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

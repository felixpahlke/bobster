"use strict";

const fs = require("node:fs");
const { DEFAULT_REGISTRY, DEFAULT_TARGET } = require("../constants");
const { BobsterError } = require("../error");
const { defaultPaths, resolveConfigPath } = require("./defaults");

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

function loadConfig(cwd: string, flags: any = {}) {
  const configPath = resolveConfigPath(cwd);
  const fileConfig = readJsonIfExists(configPath) || {};
  const target = flags.target || fileConfig.target || DEFAULT_TARGET;
  const paths = {
    ...defaultPaths(target),
    ...(fileConfig.paths || {}),
  };

  return {
    $schema: fileConfig.$schema,
    cwd,
    target,
    registry: flags.registry || fileConfig.registry || DEFAULT_REGISTRY,
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
  loadConfig,
};

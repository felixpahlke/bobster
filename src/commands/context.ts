"use strict";

const { loadConfig } = require("../config/load-config");
const { fetchRegistryIndexes } = require("../registry/fetch-index");

async function loadRegistryCommandContext(context) {
  const config = loadConfig(context.cwd, context.flags);
  const registryContext = await fetchRegistryIndexes(config.registries, { cwd: context.cwd });
  return {
    config,
    registryContext,
  };
}

module.exports = {
  loadRegistryCommandContext,
};

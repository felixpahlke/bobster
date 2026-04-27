"use strict";

const { loadConfig } = require("../config/load-config");
const { fetchRegistryIndex } = require("../registry/fetch-index");

async function loadRegistryCommandContext(context) {
  const config = loadConfig(context.cwd, context.flags);
  const registryContext = await fetchRegistryIndex(config.registry, { cwd: context.cwd });
  return {
    config,
    registryContext,
  };
}

module.exports = {
  loadRegistryCommandContext,
};

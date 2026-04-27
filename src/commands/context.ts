"use strict";

const { loadConfig } = require("../config/load-config");
const { fetchRegistryIndexes } = require("../registry/fetch-index");

async function loadRegistryCommandContext(context) {
  const config = loadConfig(context.cwd, context.flags, { env: context.env });
  const registryContext = await fetchRegistryIndexes(config.registries, {
    cwd: context.cwd,
    env: context.env,
  });
  return {
    config,
    registryContext,
  };
}

module.exports = {
  loadRegistryCommandContext,
};

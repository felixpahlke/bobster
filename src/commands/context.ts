"use strict";

const { loadConfig } = require("../config/load-config");
const { fetchRegistryIndexes } = require("../registry/fetch-index");
const { withSpinner } = require("../spinner");

function registryLoadingMessage(context) {
  const command = context.command;
  const query = context.args.join(" ").trim();
  if (command === "search") {
    return query ? "Searching registries..." : "Loading registry catalog...";
  }
  if (command === "list") {
    return query ? "Searching registries..." : "Loading registry catalog...";
  }
  if (command === "add" || command === "learn") {
    return query ? "Searching registries..." : "Loading registry catalog...";
  }
  if (command === "info" || command === "show") {
    return "Loading registry metadata...";
  }
  if (command === "update") {
    return "Checking registries...";
  }
  return "Loading registries...";
}

async function loadRegistryCommandContext(context) {
  const config = loadConfig(context.cwd, context.flags, { env: context.env });
  const registryContext = await withSpinner(context, registryLoadingMessage(context), () =>
    fetchRegistryIndexes(config.registries, {
      cwd: context.cwd,
      env: context.env,
    }),
  );
  return {
    config,
    registryContext,
  };
}

module.exports = {
  loadRegistryCommandContext,
};

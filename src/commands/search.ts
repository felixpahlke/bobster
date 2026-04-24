"use strict";

const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const { formatItemRows } = require("../output");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { searchItems } = require("../registry/search-items");

async function runSearch(context) {
  const { args, cwd, flags, io } = context;
  const query = args.join(" ").trim();
  if (!query) {
    throw new BobsterError("Usage: bobster search <query>");
  }

  const config = loadConfig(cwd, flags);
  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  const results = searchItems(registryContext.index.items, query, { type: flags.type });

  if (flags.json) {
    io.out(JSON.stringify(results, null, 2));
  } else {
    io.out(formatItemRows(results, { theme: context.theme }));
  }
}

module.exports = {
  runSearch,
};

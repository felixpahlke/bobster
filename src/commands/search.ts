"use strict";

const { BobsterError } = require("../error");
const { installRegistryItem } = require("./add");
const { formatItemRows } = require("../output");
const { searchItems } = require("../registry/search-items");
const { loadRegistryCommandContext } = require("./context");
const { selectRegistryItemForCommand } = require("./resolve");

async function runSearch(context) {
  const { args, cwd, flags, io } = context;
  const query = args.join(" ").trim();
  if (!query) {
    throw new BobsterError("Usage: bobster search <query>");
  }

  const { config, registryContext } = await loadRegistryCommandContext(context);
  const results = searchItems(registryContext.index.items, query, { type: flags.type });

  if (flags.json) {
    io.out(JSON.stringify(results, null, 2));
  } else {
    const selected = await selectRegistryItemForCommand(context, results, {
      message: "Select an item to add",
    });
    if (selected) {
      await installRegistryItem(context, config, registryContext, selected);
      return;
    }
    io.out(formatItemRows(results, { theme: context.theme }));
  }
}

module.exports = {
  runSearch,
};

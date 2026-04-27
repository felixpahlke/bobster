"use strict";

const { installRegistryItem } = require("./add");
const { formatCatalog, formatItemRows } = require("../output");
const { searchItems } = require("../registry/search-items");
const { normalizeType } = require("../registry/schemas");
const { loadRegistryCommandContext } = require("./context");
const { selectRegistryItemForCommand } = require("./resolve");

async function runSearch(context) {
  const { args, flags, io } = context;
  const query = args.join(" ").trim();

  const { config, registryContext } = await loadRegistryCommandContext(context);
  const type = flags.type ? normalizeType(flags.type) : null;
  const sourceItems = type
    ? registryContext.index.items.filter((item) => item.type === type)
    : registryContext.index.items;
  const results = query ? searchItems(sourceItems, query, { type: flags.type }) : sourceItems;

  if (flags.json) {
    io.out(JSON.stringify(results, null, 2));
  } else {
    if (!query) {
      io.out(formatCatalog(results, { theme: context.theme }));
      return;
    }

    const selected = await selectRegistryItemForCommand(context, results, {
      message: "Select an item to add",
      searchable: true,
    });
    if (selected) {
      await installRegistryItem(context, config, registryContext, selected);
      return;
    }
    io.out(formatItemRows(results, { showTopics: true, theme: context.theme }));
  }
}

module.exports = {
  runSearch,
};

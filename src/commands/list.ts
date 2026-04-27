"use strict";

const { formatCatalog, formatItemRows } = require("../output");
const { normalizeType } = require("../registry/schemas");
const { searchItems } = require("../registry/search-items");
const { readLockfile } = require("../lockfile/lockfile");
const { loadRegistryCommandContext } = require("./context");

async function runList(context) {
  const { args, cwd, flags, io } = context;

  if (flags.installed) {
    const lockfile = await readLockfile(cwd);
    const items = flags.type
      ? lockfile.items.filter((item) => item.type === normalizeType(flags.type))
      : lockfile.items;

    if (flags.json) {
      io.out(JSON.stringify(items, null, 2));
    } else {
      io.out(formatItemRows(items.map((item) => ({ ...item, description: item.version || "" })), { theme: context.theme }));
    }
    return;
  }

  const registry = await loadRegistryCommandContext(context);
  const registryContext = registry.registryContext;
  let items = flags.type
    ? registryContext.index.items.filter((item) => item.type === normalizeType(flags.type))
    : registryContext.index.items;
  const query = args.join(" ").trim();
  if (query) {
    items = searchItems(items, query, { type: flags.type });
  }

  if (flags.json) {
    io.out(JSON.stringify(items, null, 2));
  } else {
    io.out(query
      ? formatItemRows(items, { showTopics: true, theme: context.theme })
      : formatCatalog(items, { theme: context.theme }));
  }
}

module.exports = {
  runList,
};

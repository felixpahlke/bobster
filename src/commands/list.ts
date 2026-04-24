"use strict";

const { loadConfig } = require("../config/load-config");
const { formatGroupedItems, formatItemRows } = require("../output");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { normalizeType } = require("../registry/schemas");
const { readLockfile } = require("../lockfile/lockfile");

async function runList(context) {
  const { cwd, flags, io } = context;
  const config = loadConfig(cwd, flags);

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

  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  const items = flags.type
    ? registryContext.index.items.filter((item) => item.type === normalizeType(flags.type))
    : registryContext.index.items;

  if (flags.json) {
    io.out(JSON.stringify(items, null, 2));
  } else {
    io.out(formatGroupedItems(items, { theme: context.theme }));
  }
}

module.exports = {
  runList,
};

"use strict";

const { installRegistryItem } = require("./add");
const { formatGroupedItems, formatItemRows } = require("../output");
const { normalizeType } = require("../registry/schemas");
const { readLockfile } = require("../lockfile/lockfile");
const { loadRegistryCommandContext } = require("./context");
const { selectRegistryItemForCommand } = require("./resolve");

async function runList(context) {
  const { cwd, flags, io } = context;

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
  const items = flags.type
    ? registryContext.index.items.filter((item) => item.type === normalizeType(flags.type))
    : registryContext.index.items;

  if (flags.json) {
    io.out(JSON.stringify(items, null, 2));
  } else {
    const selected = await selectRegistryItemForCommand(context, items, {
      message: "Select an item to add",
    });
    if (selected) {
      await installRegistryItem(context, registry.config, registryContext, selected);
      return;
    }
    io.out(formatGroupedItems(items, { theme: context.theme }));
  }
}

module.exports = {
  runList,
};

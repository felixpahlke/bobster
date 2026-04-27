"use strict";

const { canPrompt, selectChoice } = require("../prompt");
const { formatCatalog, formatItemRows, popularTopics, topicLabel } = require("../output");
const { normalizeType } = require("../registry/schemas");
const { searchItems } = require("../registry/search-items");
const { readLockfile } = require("../lockfile/lockfile");
const { loadRegistryCommandContext } = require("./context");

async function selectTopic(context, items) {
  const topics = popularTopics(items, 12);
  if (!topics.length) {
    return null;
  }

  return selectChoice("Browse a topic", [
    ...topics.map(({ count, topic }) => ({
      name: topic,
      message: `${topicLabel(topic)}  ${count} item${count === 1 ? "" : "s"}`,
    })),
    { name: "__all", message: "All items" },
  ], {
    input: context.io.stdin,
    output: context.io.stderr,
  });
}

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

  if (!query && canPrompt(context)) {
    const selectedTopic = await selectTopic(context, items);
    if (selectedTopic && selectedTopic !== "__all") {
      items = searchItems(items, selectedTopic, { type: flags.type });
      io.out(formatItemRows(items, { columns: context.io.columns, showTopics: true, theme: context.theme }));
      return;
    }
  }

  if (flags.json) {
    io.out(JSON.stringify(items, null, 2));
  } else {
    io.out(query
      ? formatItemRows(items, { columns: context.io.columns, showTopics: true, theme: context.theme })
      : formatCatalog(items, { columns: context.io.columns, theme: context.theme }));
  }
}

module.exports = {
  runList,
};

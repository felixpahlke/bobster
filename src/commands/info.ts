"use strict";

const { BobsterError } = require("../error");
const { formatItemId } = require("../output");
const { installsRuleAsDirectory } = require("../installers/planner");
const { contextForItem } = require("../registry/fetch-index");
const { loadRegistryCommandContext } = require("./context");
const { resolveRegistryItemForCommand } = require("./resolve");

function installTarget(config, item) {
  if (item.type === "skill") {
    return `${config.paths.skills}/${item.name}/`;
  }
  if (item.type === "rule") {
    if (installsRuleAsDirectory(item)) {
      return `${config.paths.rules}/${item.name}/`;
    }
    return `${config.paths.rules}/${item.name}.md`;
  }
  return config.paths.modes;
}

async function runInfo(context) {
  const { args, flags, io } = context;
  const name = args[0];
  if (!name) {
    throw new BobsterError("Usage: bobster info <name>");
  }

  const { config, registryContext } = await loadRegistryCommandContext(context);
  const item = await resolveRegistryItemForCommand(context, registryContext, name, {
    message: "Did you mean one of these? Select an item to inspect",
  });

  if (flags.json) {
    io.out(JSON.stringify(item, null, 2));
    return;
  }

  const theme = context.theme;
  const sourceContext = contextForItem(registryContext, item);
  const sourceBase = sourceContext.index.baseUrl || sourceContext.resolvedRegistry;
  const heading = (value) => (theme ? theme.heading(value) : value);
  io.out(
    [
      formatItemId(item, theme),
      "",
      heading("Description:"),
      `  ${item.description}`,
      "",
      heading("Version:"),
      `  ${item.version}`,
      "",
      heading("Tags:"),
      `  ${(item.tags || []).join(", ")}`,
      ...(item.topics?.length
        ? ["", heading("Topics:"), `  ${item.topics.join(", ")}`]
        : []),
      ...(item.aliases?.length
        ? ["", heading("Aliases:"), `  ${item.aliases.join(", ")}`]
        : []),
      ...(item.status
        ? ["", heading("Status:"), `  ${item.status}`]
        : []),
      "",
      heading("Files:"),
      ...item.files.map((file) => `  ${file}`),
      "",
      heading("Install target:"),
      `  ${installTarget(config, item)}`,
      "",
      heading("Registry:"),
      `  ${item.registry || sourceContext.name || sourceContext.registry}`,
      "",
      heading("Source:"),
      `  ${sourceBase}/${item.path}`,
    ].join("\n"),
  );
}

module.exports = {
  runInfo,
};

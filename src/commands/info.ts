"use strict";

const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const { formatItemId } = require("../output");
const { installsRuleAsDirectory } = require("../installers/planner");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { resolveRegistryItem } = require("../registry/resolve-item");

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
  const { args, cwd, flags, io } = context;
  const name = args[0];
  if (!name) {
    throw new BobsterError("Usage: bobster info <name>");
  }

  const config = loadConfig(cwd, flags);
  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  const item = resolveRegistryItem(registryContext.index, name, { type: flags.type });

  if (flags.json) {
    io.out(JSON.stringify(item, null, 2));
    return;
  }

  const theme = context.theme;
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
      "",
      heading("Files:"),
      ...item.files.map((file) => `  ${file}`),
      "",
      heading("Install target:"),
      `  ${installTarget(config, item)}`,
      "",
      heading("Source:"),
      `  ${registryContext.index.baseUrl}/${item.path}`,
    ].join("\n"),
  );
}

module.exports = {
  runInfo,
};

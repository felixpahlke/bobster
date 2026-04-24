"use strict";

const path = require("node:path");
const { DEFAULT_REGISTRY, DEFAULT_TARGET } = require("../constants");

function slashJoin(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function defaultPaths(target = DEFAULT_TARGET) {
  return {
    skills: slashJoin(target, "skills"),
    rules: slashJoin(target, "rules"),
    modes: slashJoin(target, "custom_modes.yaml"),
  };
}

function defaultConfig(target = DEFAULT_TARGET) {
  return {
    $schema:
      "https://raw.githubusercontent.com/felixpahlke/bobster/main/schema/bobster.schema.json",
    target,
    registry: DEFAULT_REGISTRY,
    paths: defaultPaths(target),
    defaults: {
      confirmWrites: true,
      lockfile: true,
    },
  };
}

function resolveConfigPath(cwd) {
  return path.join(cwd, "bobster.json");
}

module.exports = {
  defaultConfig,
  defaultPaths,
  resolveConfigPath,
};

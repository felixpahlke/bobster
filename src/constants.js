"use strict";

const path = require("node:path");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TARGET = ".bob";
const DEFAULT_REGISTRY =
  "https://raw.githubusercontent.com/felixpahlke/bobster/main/registry/index.json";
const BUNDLED_REGISTRY_INDEX = path.join(PACKAGE_ROOT, "registry", "index.json");

const ITEM_TYPES = ["skill", "rule", "mode"];
const TYPE_LABELS = {
  skill: "Skills",
  rule: "Rules",
  mode: "Modes",
};

module.exports = {
  BUNDLED_REGISTRY_INDEX,
  DEFAULT_REGISTRY,
  DEFAULT_TARGET,
  ITEM_TYPES,
  PACKAGE_ROOT,
  TYPE_LABELS,
};

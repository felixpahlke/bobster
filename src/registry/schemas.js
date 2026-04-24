"use strict";

const { ITEM_TYPES } = require("../constants");
const { BobsterError } = require("../error");
const { assertSafeRelativePath } = require("../fs/safe-path");

const TYPE_ALIASES = {
  skills: "skill",
  skill: "skill",
  rules: "rule",
  rule: "rule",
  modes: "mode",
  mode: "mode",
};

function normalizeType(type) {
  const normalized = TYPE_ALIASES[String(type || "").toLowerCase()];
  if (!normalized) {
    throw new BobsterError(`Unknown type: ${type}`);
  }
  return normalized;
}

function isKebabCase(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new BobsterError("Registry manifest must be an object.");
  }

  if (!manifest.name || !isKebabCase(manifest.name)) {
    errors.push("name must be lowercase kebab-case");
  }

  try {
    manifest.type = normalizeType(manifest.type);
  } catch {
    errors.push("type must be one of skill, rule, or mode");
  }

  for (const field of ["version", "description", "license", "entry"]) {
    if (!manifest[field] || typeof manifest[field] !== "string") {
      errors.push(`${field} is required`);
    }
  }

  if (!Array.isArray(manifest.tags) || !manifest.tags.every((tag) => typeof tag === "string")) {
    errors.push("tags must be an array of strings");
  }

  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    errors.push("files must be a non-empty array");
  } else {
    for (const file of manifest.files) {
      try {
        assertSafeRelativePath(file, "registry file");
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  if (manifest.entry && Array.isArray(manifest.files) && !manifest.files.includes(manifest.entry)) {
    errors.push("entry must be included in files");
  }

  if (errors.length) {
    throw new BobsterError(`Invalid manifest ${manifest.name || ""}: ${errors.join("; ")}`);
  }

  return manifest;
}

function validateIndex(index) {
  if (!index || typeof index !== "object" || Array.isArray(index)) {
    throw new BobsterError("Registry index must be an object.");
  }

  if (index.schemaVersion !== 1) {
    throw new BobsterError("Registry index schemaVersion must be 1.");
  }

  if (!Array.isArray(index.items)) {
    throw new BobsterError("Registry index items must be an array.");
  }

  const seen = new Set();
  for (const item of index.items) {
    validateManifest(item);

    if (!item.path || typeof item.path !== "string") {
      throw new BobsterError(`Registry item ${item.type}/${item.name} is missing path.`);
    }
    assertSafeRelativePath(item.path, "registry item path");

    const key = `${item.type}/${item.name}`;
    if (seen.has(key)) {
      throw new BobsterError(`Duplicate registry item: ${key}`);
    }
    seen.add(key);
  }

  return index;
}

function itemTypeDirectory(type) {
  return `${normalizeType(type)}s`;
}

module.exports = {
  ITEM_TYPES,
  itemTypeDirectory,
  normalizeType,
  validateIndex,
  validateManifest,
};

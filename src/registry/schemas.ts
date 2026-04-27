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
const DISCOVERY_FIELDS = ["topics", "aliases", "keywords", "status"];
const MANIFEST_FIELDS = new Set([
  "name",
  "type",
  "version",
  "description",
  "tags",
  "files",
  "entry",
  "origin",
  ...DISCOVERY_FIELDS,
]);
const INDEX_FIELDS = new Set([...MANIFEST_FIELDS, "license", "path"]);
const STATUSES = new Set(["stable", "experimental", "deprecated"]);

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

function validateManifest(manifest, options: any = {}) {
  const errors = [];

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new BobsterError("Registry manifest must be an object.");
  }

  const allowedFields = options.allowPath ? INDEX_FIELDS : MANIFEST_FIELDS;
  for (const key of Object.keys(manifest)) {
    if (!allowedFields.has(key)) {
      errors.push(`${key} is not allowed`);
    }
  }

  if (!manifest.name || !isKebabCase(manifest.name)) {
    errors.push("name must be lowercase kebab-case");
  }

  try {
    manifest.type = normalizeType(manifest.type);
  } catch {
    errors.push("type must be one of skill, rule, or mode");
  }

  for (const field of ["version", "description", "entry"]) {
    if (!manifest[field] || typeof manifest[field] !== "string") {
      errors.push(`${field} is required`);
    }
  }

  if (!Array.isArray(manifest.tags) || !manifest.tags.every((tag) => typeof tag === "string")) {
    errors.push("tags must be an array of strings");
  }

  for (const field of ["topics", "aliases", "keywords"]) {
    if (
      manifest[field] !== undefined &&
      (!Array.isArray(manifest[field]) || !manifest[field].every((value) => typeof value === "string"))
    ) {
      errors.push(`${field} must be an array of strings`);
    }
  }

  if (manifest.status !== undefined && !STATUSES.has(manifest.status)) {
    errors.push("status must be one of stable, experimental, or deprecated");
  }

  if (manifest.origin !== undefined) {
    if (!manifest.origin || typeof manifest.origin !== "object" || Array.isArray(manifest.origin)) {
      errors.push("origin must be an object");
    } else {
      for (const [key, value] of Object.entries(manifest.origin)) {
        if (!["url", "path", "ref", "sha", "importedAt", "notes"].includes(key)) {
          errors.push(`origin.${key} is not allowed`);
        } else if (typeof value !== "string") {
          errors.push(`origin.${key} must be a string`);
        }
      }
    }
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
    validateManifest(item, { allowPath: true });

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

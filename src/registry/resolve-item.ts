"use strict";

const { BobsterError } = require("../error");
const { itemId } = require("../output");
const { normalizeType } = require("./schemas");

function parseQualifiedName(value) {
  const input = String(value || "").trim();
  const slash = input.indexOf("/");
  if (slash === -1) {
    return {
      name: input,
      type: null,
    };
  }

  return {
    name: input.slice(slash + 1),
    type: normalizeType(input.slice(0, slash)),
  };
}

function resolveRegistryItem(index: any, value: string, options: any = {}) {
  const parsed = parseQualifiedName(value);
  const requestedType = options.type ? normalizeType(options.type) : parsed.type;
  const matches = index.items.filter((item) => {
    return item.name === parsed.name && (!requestedType || item.type === requestedType);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new BobsterError(
      [
        `Multiple items found for "${value}":`,
        "",
        ...matches.map((item) => `  ${itemId(item)}`),
        "",
        "Use a type-qualified name such as skill/name, rule/name, or mode/name.",
      ].join("\n"),
    );
  }

  const suggestions = findSuggestions(index.items, parsed.name, requestedType);
  const suffix = suggestions.length
    ? `\n\nDid you mean one of these?\n${suggestions.map((item) => `  ${itemId(item)}`).join("\n")}`
    : "";
  throw new BobsterError(`No registry item found for "${value}".${suffix}`);
}

function resolveInstalledItem(lockfile: any, value: string, options: any = {}) {
  const parsed = parseQualifiedName(value);
  const requestedType = options.type ? normalizeType(options.type) : parsed.type;
  const matches = lockfile.items.filter((item) => {
    return item.name === parsed.name && (!requestedType || item.type === requestedType);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new BobsterError(
      [
        `Multiple installed items found for "${value}":`,
        "",
        ...matches.map((item) => `  ${item.type}/${item.name}`),
        "",
        "Use a type-qualified name.",
      ].join("\n"),
    );
  }

  throw new BobsterError(`No installed item found for "${value}".`);
}

function findSuggestions(items, name, type) {
  const normalized = name.toLowerCase();
  return items
    .filter((item) => !type || item.type === type)
    .filter((item) => item.name.includes(normalized) || normalized.includes(item.name))
    .slice(0, 5);
}

module.exports = {
  parseQualifiedName,
  resolveInstalledItem,
  resolveRegistryItem,
};

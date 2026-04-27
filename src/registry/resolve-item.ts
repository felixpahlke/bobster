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

  const suggestions = suggestRegistryItems(index.items, parsed.name, { type: requestedType });
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

  const suggestions = suggestRegistryItems(lockfile.items || [], parsed.name, { type: requestedType });
  const suffix = suggestions.length
    ? `\n\nDid you mean one of these?\n${suggestions.map((item) => `  ${itemId(item)}`).join("\n")}`
    : "";
  throw new BobsterError(`No installed item found for "${value}".${suffix}`);
}

function editDistance(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    distances[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    distances[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }

  return distances[left.length][right.length];
}

function fuzzyContains(value, query) {
  let offset = 0;
  for (const char of query) {
    offset = value.indexOf(char, offset);
    if (offset === -1) {
      return false;
    }
    offset += 1;
  }
  return true;
}

function suggestionScore(item, name) {
  const normalized = name.toLowerCase();
  const itemName = item.name.toLowerCase();
  const fullName = itemId(item).toLowerCase();
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());
  const haystack = `${fullName} ${tags.join(" ")} ${String(item.description || "").toLowerCase()}`;
  const distance = editDistance(normalized, itemName);
  let score = 0;

  if (itemName === normalized || fullName === normalized) score += 200;
  if (itemName.startsWith(normalized) || fullName.startsWith(normalized)) score += 90;
  if (itemName.includes(normalized) || fullName.includes(normalized)) score += 70;
  if (normalized.includes(itemName)) score += 60;
  if (tags.some((tag) => tag.includes(normalized))) score += 35;
  if (fuzzyContains(haystack, normalized)) score += 20;

  const maxDistance = normalized.length <= 5 ? 2 : Math.ceil(normalized.length / 3);
  if (distance <= maxDistance) {
    score += Math.max(10, 60 - distance * 12);
  }

  return score;
}

function suggestRegistryItems(items, name, options: any = {}) {
  const type = options.type || null;
  const limit = options.limit || 5;
  const normalized = String(name || "").toLowerCase();
  if (!normalized) {
    return [];
  }

  return items
    .filter((item) => !type || item.type === type)
    .map((item) => ({ item, score: suggestionScore(item, normalized) }))
    .filter((result) => result.score >= 20)
    .sort((a, b) => b.score - a.score || itemId(a.item).localeCompare(itemId(b.item)))
    .slice(0, limit)
    .map((result) => result.item);
}

module.exports = {
  parseQualifiedName,
  resolveInstalledItem,
  resolveRegistryItem,
  suggestRegistryItems,
};

"use strict";

const { BobsterError } = require("../error");
const { itemId } = require("../output");
const { normalizeType } = require("./schemas");

function parseQualifiedName(value) {
  const input = String(value || "").trim();
  const parts = input.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return {
      name: parts.slice(2).join("/"),
      registry: parts[0],
      type: normalizeType(parts[1]),
    };
  }

  if (parts.length === 2) {
    try {
      return {
        name: parts[1],
        registry: null,
        type: normalizeType(parts[0]),
      };
    } catch {
      return {
        name: parts[1],
        registry: parts[0],
        type: null,
      };
    }
  }

  if (parts.length === 1) {
    return {
      name: parts[0],
      registry: null,
      type: null,
    };
  }

  return {
    name: "",
    registry: null,
    type: null,
  };
}

function resolveRegistryItem(index: any, value: string, options: any = {}) {
  const parsed = parseQualifiedName(value);
  const requestedType = options.type ? normalizeType(options.type) : parsed.type;
  const matches = index.items.filter((item) => {
    return item.name === parsed.name &&
      (!requestedType || item.type === requestedType) &&
      (!parsed.registry || item.registry === parsed.registry);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new BobsterError(
      [
        `Multiple items found for "${value}":`,
        "",
        ...matches.map((item) => `  ${itemId(item, { includeRegistry: Boolean(item.registry) })}`),
        "",
        "Use a registry-qualified name such as public/skill/name or team/rule/name.",
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
    return item.name === parsed.name &&
      (!requestedType || item.type === requestedType) &&
      (!parsed.registry || item.registry === parsed.registry);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new BobsterError(
      [
        `Multiple installed items found for "${value}":`,
        "",
        ...matches.map((item) => `  ${itemId(item, { includeRegistry: Boolean(item.registry) })}`),
        "",
        "Use a registry-qualified name.",
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

function fieldValues(item, field) {
  return Array.isArray(item[field])
    ? item[field].map((value) => String(value || "").toLowerCase()).filter(Boolean)
    : [];
}

function suggestionScore(item, name) {
  const normalized = name.toLowerCase();
  const itemName = item.name.toLowerCase();
  const fullName = itemId(item, { includeRegistry: Boolean(item.registry) }).toLowerCase();
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());
  const topics = fieldValues(item, "topics");
  const aliases = fieldValues(item, "aliases");
  const keywords = fieldValues(item, "keywords");
  const haystack = `${fullName} ${topics.join(" ")} ${aliases.join(" ")} ${keywords.join(" ")} ${tags.join(" ")} ${String(item.description || "").toLowerCase()}`;
  const distance = editDistance(normalized, itemName);
  let score = 0;

  if (itemName === normalized || fullName === normalized) score += 200;
  if (itemName.startsWith(normalized) || fullName.startsWith(normalized)) score += 90;
  if (itemName.includes(normalized) || fullName.includes(normalized)) score += 70;
  if (normalized.includes(itemName)) score += 60;
  if (aliases.some((alias) => alias === normalized)) score += 85;
  if (topics.some((topic) => topic === normalized)) score += 75;
  if (keywords.some((keyword) => keyword === normalized)) score += 65;
  if (aliases.some((alias) => alias.includes(normalized))) score += 45;
  if (topics.some((topic) => topic.includes(normalized))) score += 40;
  if (keywords.some((keyword) => keyword.includes(normalized))) score += 35;
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
  const registry = options.registry || null;
  const limit = options.limit || 5;
  const normalized = String(name || "").toLowerCase();
  if (!normalized) {
    return [];
  }

  return items
    .filter((item) => (!type || item.type === type) && (!registry || item.registry === registry))
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

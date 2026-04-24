"use strict";

const { normalizeType } = require("./schemas");

function tokenize(query) {
  return String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
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

function scoreItem(item, tokens) {
  const name = item.name.toLowerCase();
  const type = item.type.toLowerCase();
  const description = item.description.toLowerCase();
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());
  let score = 0;

  for (const token of tokens) {
    if (name === token) score += 100;
    if (name.startsWith(token)) score += 60;
    if (tags.includes(token)) score += 45;
    if (name.includes(token)) score += 35;
    if (type.includes(token)) score += 25;
    if (tags.some((tag) => tag.includes(token))) score += 20;
    if (description.includes(token)) score += 15;
    if (fuzzyContains(`${type} ${name} ${tags.join(" ")} ${description}`, token)) score += 5;
  }

  return score;
}

function searchItems(items, query, options = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return [];
  }

  const type = options.type ? normalizeType(options.type) : null;
  return items
    .filter((item) => !type || item.type === type)
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((result) => result.score >= 10)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((result) => result.item);
}

module.exports = {
  searchItems,
};

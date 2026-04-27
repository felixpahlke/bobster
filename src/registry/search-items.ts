"use strict";

const { normalizeType } = require("./schemas");

function tokenize(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}/.-]+/gu, " ")
    .split(/[\s/]+/)
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

function fieldValues(item, field) {
  return Array.isArray(item[field])
    ? item[field].map((value) => String(value || "").toLowerCase()).filter(Boolean)
    : [];
}

function splitValue(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[\s/_.-]+/)
    .filter(Boolean);
}

function scoreField(values, token, exactScore, partialScore) {
  let score = 0;
  for (const value of values) {
    if (value === token) score += exactScore;
    if (splitValue(value).includes(token)) score += Math.floor(exactScore * 0.8);
    if (value.includes(token)) score += partialScore;
  }
  return score;
}

function scoreItem(item, tokens) {
  const name = item.name.toLowerCase();
  const type = item.type.toLowerCase();
  const registry = String(item.registry || "").toLowerCase();
  const description = String(item.description || "").toLowerCase();
  const tags = fieldValues(item, "tags");
  const topics = fieldValues(item, "topics");
  const aliases = fieldValues(item, "aliases");
  const keywords = fieldValues(item, "keywords");
  const phrase = tokens.join(" ");
  let score = 0;

  const exactPhraseValues = [name, ...aliases, ...topics, ...keywords, ...tags];
  if (exactPhraseValues.includes(phrase)) score += 140;
  if (exactPhraseValues.some((value) => value.includes(phrase))) score += 60;

  for (const token of tokens) {
    if (name === token) score += 100;
    if (splitValue(name).includes(token)) score += 80;
    if (name.startsWith(token)) score += 60;
    score += scoreField(aliases, token, 90, 40);
    score += scoreField(topics, token, 70, 35);
    score += scoreField(keywords, token, 55, 25);
    if (tags.includes(token)) score += 45;
    if (name.includes(token)) score += 35;
    if (type.includes(token)) score += 25;
    if (registry.includes(token)) score += 25;
    if (tags.some((tag) => tag.includes(token))) score += 20;
    if (description.includes(token)) score += 15;
    if (
      fuzzyContains(
        `${registry} ${type} ${name} ${topics.join(" ")} ${aliases.join(" ")} ${keywords.join(" ")} ${tags.join(" ")} ${description}`,
        token,
      )
    ) {
      score += 5;
    }
  }

  if (item.status === "stable") score += 2;
  if (item.status === "deprecated") score -= 10;

  return score;
}

function searchItems(items: any[], query: string, options: any = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return [];
  }

  const type = options.type ? normalizeType(options.type) : null;
  return items
    .filter((item) => !type || item.type === type)
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((result) => result.score >= 10)
    .sort((a, b) => b.score - a.score || `${a.item.type}/${a.item.name}`.localeCompare(`${b.item.type}/${b.item.name}`))
    .map((result) => result.item);
}

module.exports = {
  scoreItem,
  searchItems,
  tokenize,
};

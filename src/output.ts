"use strict";

const { TYPE_LABELS } = require("./constants");

function itemId(item) {
  return `${item.type}/${item.name}`;
}

function formatItemId(item, theme) {
  return theme ? theme.id(itemId(item)) : itemId(item);
}

function groupItems(items) {
  return items.reduce((groups, item) => {
    groups[item.type] ||= [];
    groups[item.type].push(item);
    return groups;
  }, {});
}

function formatItemRows(items: any[], options: any = {}) {
  if (!items.length) {
    return "No items found.";
  }

  const theme = options.theme;
  const width = Math.max(...items.map((item) => itemId(item).length), 10);
  return items
    .map((item) => {
      const paddedId = itemId(item).padEnd(width);
      return `${theme ? theme.id(paddedId) : paddedId}  ${item.description}`;
    })
    .join("\n");
}

function formatGroupedItems(items: any[], options: any = {}) {
  if (!items.length) {
    return "No items found.";
  }

  const theme = options.theme;
  const groups = groupItems(items);
  const sections = [];

  for (const type of ["skill", "rule", "mode"]) {
    const typeItems = groups[type] || [];
    if (!typeItems.length) {
      continue;
    }

    const width = Math.max(...typeItems.map((item) => item.name.length), 10);
    sections.push(theme ? theme.heading(TYPE_LABELS[type]) : TYPE_LABELS[type]);
    for (const item of typeItems) {
      const paddedName = item.name.padEnd(width);
      const name = theme ? theme.id(paddedName) : paddedName;
      sections.push(`  ${name}  ${item.description}`);
    }
    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

module.exports = {
  formatItemId,
  formatGroupedItems,
  formatItemRows,
  itemId,
};

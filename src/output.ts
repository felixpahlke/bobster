"use strict";

const { TYPE_LABELS } = require("./constants");

const TOPIC_LABELS = {
  accessibility: "Accessibility",
  agents: "Agents",
  ai: "AI",
  "api-design": "API Design",
  code: "Code",
  "code-review": "Code Review",
  communication: "Communication",
  compliance: "Compliance",
  data: "Data",
  "data-ai": "Data/AI",
  database: "Database",
  debug: "Debug",
  debugging: "Debugging",
  design: "Design",
  devsecops: "DevSecOps",
  devops: "DevOps",
  documentation: "Documentation",
  frontend: "Frontend",
  industry: "Industry",
  kubernetes: "Kubernetes",
  learning: "Learning",
  migration: "Migration",
  onboarding: "Onboarding",
  openshift: "OpenShift",
  quality: "Quality",
  readme: "README",
  review: "Review",
  security: "Security",
  sql: "SQL",
  testing: "Testing",
  tools: "Tools",
  typescript: "TypeScript",
  upgrade: "Upgrade",
  watsonx: "watsonx",
};

function itemId(item, options: any = {}) {
  const id = `${item.type}/${item.name}`;
  if ((options.includeRegistry || item._includeRegistry) && item.registry) {
    return `${item.registry}/${id}`;
  }
  return id;
}

function formatItemId(item, theme) {
  return theme ? theme.id(itemId(item)) : itemId(item);
}

function discoveryValues(item, field) {
  return Array.isArray(item[field]) ? item[field].filter((value) => typeof value === "string" && value.trim()) : [];
}

function itemTopics(item) {
  const topics = discoveryValues(item, "topics");
  return topics.length ? topics : discoveryValues(item, "tags").slice(0, 2);
}

function visibleBrowseStatus(item) {
  return item.status === "deprecated" ? item.status : null;
}

function browseMetadata(item) {
  const details = [];
  const topics = itemTopics(item).slice(0, 3);
  if (topics.length) {
    details.push(topics.map(topicLabel).join(", "));
  }

  const status = visibleBrowseStatus(item);
  if (status) {
    details.push(status);
  }
  return details;
}

function topicLabel(topic) {
  const normalized = String(topic || "").toLowerCase();
  if (TOPIC_LABELS[normalized]) {
    return TOPIC_LABELS[normalized];
  }
  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusRank(item) {
  if (item.status === "stable") return 0;
  if (item.status === "experimental" || !item.status) return 1;
  if (item.status === "deprecated") return 3;
  return 2;
}

function typeRank(item) {
  return ["skill", "rule", "mode"].indexOf(item.type);
}

function compareDiscoveryItems(left, right) {
  return statusRank(left) - statusRank(right) ||
    typeRank(left) - typeRank(right) ||
    itemId(left).localeCompare(itemId(right));
}

function groupItems(items) {
  return items.reduce((groups, item) => {
    groups[item.type] ||= [];
    groups[item.type].push(item);
    return groups;
  }, {});
}

function outputColumns(options: any = {}) {
  return Math.max(60, Number(options.columns || process.stdout?.columns || 100));
}

function wrapWords(text, width) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }
    if (line.length + 1 + word.length <= width) {
      line += ` ${word}`;
      continue;
    }
    lines.push(line);
    line = word;
  }

  if (line) {
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function formatColumns(left, right, options: any = {}) {
  const leftWidth = options.leftWidth;
  const theme = options.theme;
  const columns = outputColumns(options);
  const gap = "  ";
  const indent = " ".repeat(options.indent || 0);
  const leftText = String(left || "");
  const rightWidth = Math.max(24, columns - indent.length - leftWidth - gap.length);
  const lines = wrapWords(right, rightWidth);
  const firstLeft = leftText.padEnd(leftWidth);
  const continuation = " ".repeat(leftWidth);
  const formatLeft = (value) => (theme ? theme.id(value) : value);

  return lines
    .map((line, index) =>
      `${indent}${formatLeft(index === 0 ? firstLeft : continuation)}${gap}${line}`.trimEnd(),
    )
    .join("\n");
}

function formatItemRows(items: any[], options: any = {}) {
  if (!items.length) {
    return "No items found.";
  }

  const theme = options.theme;
  const width = Math.max(...items.map((item) => itemId(item).length), 10);
  return items
    .map((item) => {
      const id = itemId(item);
      const details = [];
      if (options.showTopics) {
        details.push(...browseMetadata(item));
      }
      const suffix = details.length ? `  [${details.join("; ")}]` : "";
      return formatColumns(id, `${item.description}${suffix}`, {
        columns: options.columns,
        leftWidth: width,
        theme,
      });
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

    const width = Math.max(
      ...typeItems.map((item) => (item._includeRegistry ? itemId(item, { includeRegistry: true }) : item.name).length),
      10,
    );
    sections.push(theme ? theme.heading(TYPE_LABELS[type]) : TYPE_LABELS[type]);
    for (const item of typeItems) {
      const label = item._includeRegistry ? itemId(item, { includeRegistry: true }) : item.name;
      sections.push(formatColumns(label, item.description, {
        columns: options.columns,
        indent: 2,
        leftWidth: width,
        theme,
      }));
    }
    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

function popularTopics(items: any[], limit = 10) {
  const counts = new Map();
  for (const item of items) {
    for (const topic of itemTopics(item)) {
      const normalized = topic.toLowerCase();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || topicLabel(left[0]).localeCompare(topicLabel(right[0])))
    .slice(0, limit)
    .map(([topic, count]) => ({ count, topic }));
}

function formatTopicRows(items: any[], options: any = {}) {
  const topics = popularTopics(items, options.limit || 10);
  if (!topics.length) {
    return "";
  }

  const theme = options.theme;
  const width = Math.max(...topics.map((topic) => topicLabel(topic.topic).length), 10);
  return topics
    .map(({ count, topic }) => {
      const label = topicLabel(topic).padEnd(width);
      const name = theme ? theme.id(label) : label;
      return `  ${name}  ${count} item${count === 1 ? "" : "s"}`;
    })
    .join("\n");
}

function formatCatalog(items: any[], options: any = {}) {
  if (!items.length) {
    return "No items found.";
  }

  const theme = options.theme;
  const heading = (value) => (theme ? theme.heading(value) : value);
  const sections = [];
  const topics = formatTopicRows(items, { limit: options.topicLimit || 10, theme });
  if (topics) {
    sections.push(heading("Popular Topics"));
    sections.push(topics);
    sections.push("");
  }

  const recommended = items
    .filter((item) => visibleBrowseStatus(item) !== "deprecated")
    .sort(compareDiscoveryItems)
    .slice(0, options.recommendedLimit || 8);
  if (recommended.length) {
    sections.push(heading("Recommended"));
    sections.push(formatItemRows(recommended, { columns: options.columns, showTopics: true, theme }));
    sections.push("");
  }

  const allLimit = options.allLimit || 15;
  if (items.length <= allLimit) {
    sections.push(heading("All Items"));
    sections.push(formatGroupedItems(items, { columns: options.columns, theme }));
  } else {
    sections.push(
      `${items.length} items available. Use ${theme ? theme.id("bobster list <topic>") : "bobster list <topic>"} or ${theme ? theme.id("bobster search <query>") : "bobster search <query>"} to narrow results.`,
    );
  }

  return sections.join("\n").trimEnd();
}

module.exports = {
  browseMetadata,
  compareDiscoveryItems,
  formatCatalog,
  formatItemId,
  formatGroupedItems,
  formatItemRows,
  itemId,
  itemTopics,
  popularTopics,
  topicLabel,
  visibleBrowseStatus,
};

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

function formatItemRows(items: any[], options: any = {}) {
  if (!items.length) {
    return "No items found.";
  }

  const theme = options.theme;
  const width = Math.max(...items.map((item) => itemId(item).length), 10);
  return items
    .map((item) => {
      const paddedId = itemId(item).padEnd(width);
      const details = [];
      if (options.showTopics) {
        const topics = itemTopics(item).slice(0, 3);
        if (topics.length) {
          details.push(topics.map(topicLabel).join(", "));
        }
        if (item.status && item.status !== "stable") {
          details.push(item.status);
        }
      }
      const suffix = details.length ? `  [${details.join("; ")}]` : "";
      return `${theme ? theme.id(paddedId) : paddedId}  ${item.description}${suffix}`;
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
      const paddedName = label.padEnd(width);
      const name = theme ? theme.id(paddedName) : paddedName;
      sections.push(`  ${name}  ${item.description}`);
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
    .filter((item) => item.status === "stable" || !item.status)
    .sort(compareDiscoveryItems)
    .slice(0, options.recommendedLimit || 8);
  if (recommended.length) {
    sections.push(heading("Recommended"));
    sections.push(formatItemRows(recommended, { showTopics: true, theme }));
    sections.push("");
  }

  const allLimit = options.allLimit || 15;
  if (items.length <= allLimit) {
    sections.push(heading("All Items"));
    sections.push(formatGroupedItems(items, { theme }));
  } else {
    sections.push(
      `${items.length} items available. Use ${theme ? theme.id("bobster list <topic>") : "bobster list <topic>"} or ${theme ? theme.id("bobster search <query>") : "bobster search <query>"} to narrow results.`,
    );
  }

  return sections.join("\n").trimEnd();
}

module.exports = {
  compareDiscoveryItems,
  formatCatalog,
  formatItemId,
  formatGroupedItems,
  formatItemRows,
  itemId,
  itemTopics,
  topicLabel,
};

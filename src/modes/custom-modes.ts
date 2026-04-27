"use strict";

const { BobsterError } = require("../error");

const MODE_TOP_LEVEL_KEYS = new Set([
  "slug",
  "name",
  "description",
  "roleDefinition",
  "whenToUse",
  "groups",
  "customInstructions",
  "source",
  "rulesFiles",
]);

function ensureNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function extractModeSlug(modeYaml) {
  const match = modeYaml.match(/^slug:\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/m);
  if (!match) {
    throw new BobsterError("Mode YAML must include a top-level slug field.");
  }
  return match[1];
}

function topLevelModeKey(line) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s|$)/);
  return match && MODE_TOP_LEVEL_KEYS.has(match[1]) ? match[1] : null;
}

function isTopLevelBlockScalar(line) {
  return Boolean(
    topLevelModeKey(line) &&
      /^[A-Za-z][A-Za-z0-9_-]*:\s*[>|][0-9+-]*\s*(?:#.*)?$/.test(line),
  );
}

function leadingSpaces(line) {
  return line.match(/^ */)[0].length;
}

function hasNestedTopLevelValue(line) {
  return Boolean(topLevelModeKey(line) && /^[A-Za-z][A-Za-z0-9_-]*:\s*(?:#.*)?$/.test(line));
}

function normalizeNestedLines(lines) {
  const indents = lines
    .filter((line) => line.trim())
    .map(leadingSpaces);
  const minIndent = indents.length ? Math.min(...indents) : 2;
  const indentShift = Math.max(0, 2 - minIndent);

  return lines.map((line) => (line.trim() && indentShift ? `${" ".repeat(indentShift)}${line}` : line));
}

function normalizeModeYaml(modeYaml) {
  const lines = modeYaml.replace(/\r\n/g, "\n").trim().split("\n");
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    normalized.push(line);

    if (!isTopLevelBlockScalar(line) && !hasNestedTopLevelValue(line)) {
      continue;
    }

    const nestedLines = [];
    index += 1;
    while (index < lines.length && !topLevelModeKey(lines[index])) {
      nestedLines.push(lines[index]);
      index += 1;
    }
    index -= 1;

    normalized.push(...normalizeNestedLines(nestedLines));
  }

  return normalized.join("\n");
}

function modeYamlToListBlock(modeYaml) {
  const trimmed = normalizeModeYaml(modeYaml);
  if (!trimmed) {
    throw new BobsterError("Mode YAML is empty.");
  }

  return `${trimmed
    .split("\n")
    .map((line, index) => (index === 0 ? `  - ${line}` : `    ${line}`))
    .join("\n")}\n`;
}

function normalizeBlock(block) {
  return block.replace(/\r\n/g, "\n").trim();
}

function parseEntries(content) {
  const normalized = ensureNewline(content.replace(/\r\n/g, "\n"));
  const lines = normalized.trimEnd().split("\n");
  const customModesIndex = lines.findIndex((line) => /^customModes:\s*(?:\[\])?\s*$/.test(line));

  if (customModesIndex === -1) {
    throw new BobsterError("custom_modes.yaml must contain a customModes key.");
  }

  if (/^customModes:\s*\[\]\s*$/.test(lines[customModesIndex])) {
    return {
      customModesIndex,
      entries: [],
      lines: [...lines.slice(0, customModesIndex), "customModes:"],
    };
  }

  const starts = [];
  for (let index = customModesIndex + 1; index < lines.length; index += 1) {
    if (/^  - /.test(lines[index])) {
      starts.push(index);
    }
  }

  const entries = starts.map((start, index) => {
    const end = starts[index + 1] || lines.length;
    const blockLines = lines.slice(start, end);
    const block = `${blockLines.join("\n")}\n`;
    const slugMatch = block.match(/^(?:  - slug:|    slug:)\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/m);
    return {
      block,
      end,
      slug: slugMatch ? slugMatch[1] : null,
      start,
    };
  });

  return {
    customModesIndex,
    entries,
    lines,
  };
}

function mergeModeYaml(existingContent: string, modeYaml: string, options: any = {}) {
  const slug = extractModeSlug(modeYaml);
  const nextBlock = modeYamlToListBlock(modeYaml);
  const content = existingContent && existingContent.trim() ? existingContent : "customModes: []\n";
  const parsed = parseEntries(content);
  const existing = parsed.entries.find((entry) => entry.slug === slug);

  if (!existing) {
    const lines = [...parsed.lines];
    const insertAt = parsed.entries.length
      ? parsed.entries[parsed.entries.length - 1].end
      : parsed.customModesIndex + 1;
    lines.splice(insertAt, 0, ...nextBlock.trimEnd().split("\n"));
    return {
      changed: true,
      conflict: false,
      content: ensureNewline(lines.join("\n")),
      slug,
    };
  }

  if (normalizeBlock(existing.block) === normalizeBlock(nextBlock)) {
    return {
      changed: false,
      conflict: false,
      content: ensureNewline(parsed.lines.join("\n")),
      slug,
    };
  }

  if (!options.allowOverwrite) {
    const lines = [...parsed.lines];
    lines.splice(existing.start, existing.end - existing.start, ...nextBlock.trimEnd().split("\n"));
    return {
      changed: false,
      conflict: true,
      content: ensureNewline(lines.join("\n")),
      currentBlock: existing.block,
      nextBlock,
      slug,
    };
  }

  const lines = [...parsed.lines];
  lines.splice(existing.start, existing.end - existing.start, ...nextBlock.trimEnd().split("\n"));
  return {
    changed: true,
    conflict: false,
    content: ensureNewline(lines.join("\n")),
    slug,
  };
}

function removeModeYaml(existingContent, slug) {
  const parsed = parseEntries(existingContent || "customModes: []\n");
  const existing = parsed.entries.find((entry) => entry.slug === slug);
  if (!existing) {
    return {
      changed: false,
      content: ensureNewline(parsed.lines.join("\n")),
    };
  }

  const lines = [...parsed.lines];
  lines.splice(existing.start, existing.end - existing.start);
  if (!lines.slice(parsed.customModesIndex + 1).some((line) => /^  - /.test(line))) {
    lines.splice(parsed.customModesIndex, 1, "customModes: []");
  }

  return {
    changed: true,
    content: ensureNewline(lines.join("\n")),
  };
}

module.exports = {
  extractModeSlug,
  mergeModeYaml,
  modeYamlToListBlock,
  removeModeYaml,
};

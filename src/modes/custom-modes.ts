"use strict";

const { BobsterError } = require("../error");

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

function modeYamlToListBlock(modeYaml) {
  const trimmed = modeYaml.replace(/\r\n/g, "\n").trim();
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

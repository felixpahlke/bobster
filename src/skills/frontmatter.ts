"use strict";

function isFrontmatterFence(line) {
  return /^---\s*$/.test(line);
}

function isTopLevelFrontmatterKey(line) {
  return /^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(line);
}

function blockScalarField(line) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*[>|][0-9+-]*\s*(?:#.*)?$/);
  return match ? match[1] : null;
}

function leadingSpaces(line) {
  return line.match(/^ */)[0].length;
}

function stripSharedIndent(lines) {
  const indents = lines
    .filter((line) => line.trim())
    .map(leadingSpaces);
  const minIndent = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => (line.trim() ? line.slice(minIndent) : ""));
}

function singleLineScalar(lines) {
  return stripSharedIndent(lines).join("\n").replace(/\s+/g, " ").trim();
}

function normalizeSkillFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (!isFrontmatterFence(lines[0])) {
    return content;
  }

  const end = lines.findIndex((line, index) => index > 0 && isFrontmatterFence(line));
  if (end === -1) {
    return content;
  }

  const frontmatter = [];
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    const field = blockScalarField(line);
    if (!field) {
      frontmatter.push(line);
      continue;
    }

    const valueLines = [];
    index += 1;
    while (index < end && !isTopLevelFrontmatterKey(lines[index])) {
      valueLines.push(lines[index]);
      index += 1;
    }
    index -= 1;

    frontmatter.push(`${field}: ${JSON.stringify(singleLineScalar(valueLines))}`);
  }

  return [
    lines[0],
    ...frontmatter,
    ...lines.slice(end),
  ].join("\n");
}

module.exports = {
  normalizeSkillFrontmatter,
};

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { toDisplayPath } = require("./safe-path");

function createWritePlan() {
  return {
    creates: [],
    updates: [],
    deletes: [],
    unchanged: [],
    conflicts: [],
  };
}

function appendPlan(target, source) {
  target.creates.push(...source.creates);
  target.updates.push(...source.updates);
  target.deletes.push(...source.deletes);
  target.unchanged.push(...source.unchanged);
  target.conflicts.push(...source.conflicts);
  return target;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function addPlannedWrite(plan, cwd, filePath, content, options = {}) {
  const displayPath = options.displayPath || toDisplayPath(cwd, filePath);
  const existing = await readFileIfExists(filePath);

  const write = {
    content,
    displayPath,
    item: options.item,
    path: filePath,
  };

  if (existing === null) {
    plan.creates.push(write);
    return;
  }

  if (existing === content) {
    plan.unchanged.push(write);
    return;
  }

  if (options.allowOverwrite) {
    plan.updates.push(write);
    return;
  }

  plan.conflicts.push({
    ...write,
    current: existing,
  });
}

async function addPlannedDelete(plan, cwd, filePath, options = {}) {
  if (!(await fileExists(filePath))) {
    return;
  }

  plan.deletes.push({
    displayPath: options.displayPath || toDisplayPath(cwd, filePath),
    item: options.item,
    path: filePath,
  });
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function hasChanges(plan) {
  return Boolean(plan.creates.length || plan.updates.length || plan.deletes.length);
}

function hasWrites(plan) {
  return Boolean(
    plan.creates.length ||
      plan.updates.length ||
      plan.deletes.length ||
      plan.conflicts.length,
  );
}

async function applyWritePlan(plan, options = {}) {
  const writes = [...plan.creates, ...plan.updates];
  if (options.forceConflicts) {
    writes.push(...plan.conflicts);
  }

  for (const write of writes) {
    await fs.mkdir(path.dirname(write.path), { recursive: true });
    await fs.writeFile(write.path, write.content, "utf8");
  }

  for (const deletion of plan.deletes) {
    await fs.rm(deletion.path, { force: true });
  }
}

function formatPlan(plan, options = {}) {
  const lines = [];
  const indent = options.indent || "  ";
  const theme = options.theme;
  const heading = (value) => (theme ? theme.heading(value) : value);

  if (plan.creates.length) {
    lines.push(heading("Files to create:"));
    for (const item of plan.creates) {
      lines.push(`${indent}${theme ? theme.success(item.displayPath) : item.displayPath}`);
    }
    lines.push("");
  }

  if (plan.updates.length) {
    lines.push(heading("Files to update:"));
    for (const item of plan.updates) {
      lines.push(`${indent}${theme ? theme.warn(item.displayPath) : item.displayPath}`);
    }
    lines.push("");
  }

  if (plan.deletes.length) {
    lines.push(heading("Files to remove:"));
    for (const item of plan.deletes) {
      lines.push(`${indent}${theme ? theme.danger(item.displayPath) : item.displayPath}`);
    }
    lines.push("");
  }

  if (plan.conflicts.length) {
    lines.push(heading("Conflicts:"));
    for (const item of plan.conflicts) {
      lines.push(`${indent}${theme ? theme.danger(item.displayPath) : item.displayPath}`);
    }
    lines.push("");
  }

  if (!lines.length && plan.unchanged.length) {
    lines.push("No file changes needed.");
  }

  return lines.join("\n").trimEnd();
}

module.exports = {
  addPlannedDelete,
  addPlannedWrite,
  appendPlan,
  applyWritePlan,
  createWritePlan,
  fileExists,
  formatPlan,
  hasChanges,
  hasWrites,
  readFileIfExists,
};

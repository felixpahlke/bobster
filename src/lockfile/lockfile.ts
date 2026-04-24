"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function lockfilePath(cwd) {
  return path.join(cwd, "bobster-lock.json");
}

async function readLockfile(cwd) {
  const filePath = lockfilePath(cwd);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return {
      lockfileVersion: 1,
      registry: parsed.registry,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        lockfileVersion: 1,
        registry: null,
        items: [],
      };
    }
    throw error;
  }
}

async function writeLockfile(cwd, lockfile) {
  const filePath = lockfilePath(cwd);
  const normalized = {
    lockfileVersion: 1,
    registry: lockfile.registry || null,
    items: [...(lockfile.items || [])].sort((a, b) =>
      `${a.type}/${a.name}`.localeCompare(`${b.type}/${b.name}`),
    ),
  };
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

function upsertLockItem(lockfile, item) {
  lockfile.items = lockfile.items.filter(
    (existing) => existing.type !== item.type || existing.name !== item.name,
  );
  lockfile.items.push(item);
  return lockfile;
}

function removeLockItem(lockfile, item) {
  lockfile.items = lockfile.items.filter(
    (existing) => existing.type !== item.type || existing.name !== item.name,
  );
  return lockfile;
}

module.exports = {
  lockfilePath,
  readLockfile,
  removeLockItem,
  upsertLockItem,
  writeLockfile,
};

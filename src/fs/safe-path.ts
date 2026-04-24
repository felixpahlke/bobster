"use strict";

const path = require("node:path");
const { BobsterError } = require("../error");

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const normalized = normalizeSlashes(value);
  if (normalized.startsWith("/") || path.isAbsolute(value)) {
    return false;
  }

  return normalized
    .split("/")
    .every((part) => part && part !== "." && part !== "..");
}

function assertSafeRelativePath(value, label = "path") {
  if (!isSafeRelativePath(value)) {
    throw new BobsterError(`Unsafe ${label}: ${value}`);
  }
}

function resolveProjectPath(cwd, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(cwd, value);
}

function toDisplayPath(cwd, value) {
  const absolute = path.isAbsolute(value) ? value : path.resolve(cwd, value);
  const relative = path.relative(cwd, absolute);
  const display = relative && !relative.startsWith("..") ? relative : absolute;
  return normalizeSlashes(display);
}

module.exports = {
  assertSafeRelativePath,
  isSafeRelativePath,
  normalizeSlashes,
  resolveProjectPath,
  toDisplayPath,
};

"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_PACKAGE_NAME = "bobster-cli";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1000;

function parseVersion(version) {
  const match = String(version || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

function comparePrerelease(left, right) {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const max = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < max; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (leftPart === rightPart) {
      continue;
    }

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Number(leftPart) > Number(rightPart) ? 1 : -1;
    }
    if (leftNumeric) {
      return -1;
    }
    if (rightNumeric) {
      return 1;
    }
    return leftPart > rightPart ? 1 : -1;
  }

  return 0;
}

function compareVersions(left, right) {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  for (const key of ["major", "minor", "patch"]) {
    if (parsedLeft[key] !== parsedRight[key]) {
      return parsedLeft[key] > parsedRight[key] ? 1 : -1;
    }
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

function cacheRoot() {
  if (process.env.XDG_CACHE_HOME) {
    return process.env.XDG_CACHE_HOME;
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return process.env.LOCALAPPDATA;
  }
  return path.join(os.homedir(), ".cache");
}

function defaultCacheFile(packageName = DEFAULT_PACKAGE_NAME) {
  return path.join(cacheRoot(), packageName, "update-check.json");
}

async function readCache(cacheFile) {
  try {
    return JSON.parse(await fs.readFile(cacheFile, "utf8"));
  } catch (error) {
    return null;
  }
}

async function writeCache(cacheFile, cache) {
  try {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  } catch (error) {
    // Update checks should never make the CLI fail.
  }
}

async function fetchLatestVersion(options: any = {}) {
  if (typeof fetch !== "function") {
    return null;
  }

  const packageName = options.packageName || DEFAULT_PACKAGE_NAME;
  const latestUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(latestUrl, {
      headers: {
        accept: "application/json",
        "user-agent": `${packageName}/${options.currentVersion || "unknown"}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const metadata = await response.json();
    return typeof metadata.version === "string" ? metadata.version : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdate(options: any = {}) {
  const currentVersion = options.currentVersion;
  const packageName = options.packageName || DEFAULT_PACKAGE_NAME;
  const cacheFile = options.cacheFile || defaultCacheFile(packageName);
  const now = options.now ? options.now() : Date.now();
  const intervalMs = options.intervalMs || CHECK_INTERVAL_MS;
  const cached = await readCache(cacheFile);

  if (cached && typeof cached.checkedAt === "number" && now - cached.checkedAt < intervalMs) {
    return null;
  }

  const latestVersion = options.fetchLatestVersion
    ? await options.fetchLatestVersion()
    : await fetchLatestVersion({ currentVersion, packageName, timeoutMs: options.timeoutMs });

  await writeCache(cacheFile, {
    checkedAt: now,
    latestVersion,
  });

  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    return null;
  }

  return {
    currentVersion,
    latestVersion,
  };
}

module.exports = {
  checkForUpdate,
  compareVersions,
};

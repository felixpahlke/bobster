"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");
const { BobsterError } = require("../error");

const execFileAsync = promisify(execFile);

function githubBlobInfo(source) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (!url.hostname.includes("github")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const blobIndex = parts.indexOf("blob");
  if (blobIndex !== 2 || parts.length < 5) {
    return null;
  }

  return {
    host: url.hostname,
    owner: parts[0],
    path: parts.slice(4).join("/"),
    ref: parts[3],
    repo: parts[1],
  };
}

function githubRepoInfo(source) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (!url.hostname.includes("github")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  if (parts.length === 2) {
    return {
      host: url.hostname,
      owner: parts[0],
      path: "registry/index.json",
      ref: url.searchParams.get("ref") || "main",
      repo: parts[1],
    };
  }

  const treeIndex = parts.indexOf("tree");
  if (treeIndex !== 2 || parts.length < 4) {
    return null;
  }

  const treePath = parts.slice(4).join("/");
  const indexPath = treePath && path.posix.extname(treePath) ? treePath : `${treePath || "registry"}/index.json`;
  return {
    host: url.hostname,
    owner: parts[0],
    path: indexPath,
    ref: parts[3],
    repo: parts[1],
  };
}

function githubContentsUrl(info) {
  const encodedPath = info.path.split("/").map(encodeURIComponent).join("/");
  const encodedRepo = `${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}`;
  const query = `ref=${encodeURIComponent(info.ref)}`;
  if (info.host === "github.com") {
    return `https://api.github.com/repos/${encodedRepo}/contents/${encodedPath}?${query}`;
  }
  return `https://${info.host}/api/v3/repos/${encodedRepo}/contents/${encodedPath}?${query}`;
}

function normalizeHttpSource(source) {
  const info = githubBlobInfo(source) || githubRepoInfo(source);
  if (info) {
    return {
      headers: {
        Accept: "application/vnd.github.raw",
      },
      source: githubContentsUrl(info),
    };
  }

  let url;
  try {
    url = new URL(source);
  } catch {
    return {
      headers: {},
      source,
    };
  }

  const isGithubContentsApi =
    (url.hostname === "api.github.com" && url.pathname.startsWith("/repos/") && url.pathname.includes("/contents/")) ||
    (url.pathname.startsWith("/api/v3/repos/") && url.pathname.includes("/contents/"));

  return {
    headers: isGithubContentsApi ? { Accept: "application/vnd.github.raw" } : {},
    source,
  };
}

function githubAuthHost(source) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (url.hostname === "api.github.com" || url.hostname === "raw.githubusercontent.com") {
    return "github.com";
  }
  if (url.hostname.startsWith("raw.")) {
    return url.hostname.slice("raw.".length);
  }
  return url.hostname.includes("github") ? url.hostname : null;
}

async function githubToken(host) {
  try {
    const result = await execFileAsync("gh", ["auth", "token", "-h", host], {
      timeout: 10000,
    });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function fetchHttpText(source) {
  if (typeof fetch !== "function") {
    throw new BobsterError("This Node.js runtime does not provide fetch().");
  }

  const normalized = normalizeHttpSource(source);
  const response = await fetch(normalized.source, {
    headers: normalized.headers,
  });
  if (response.ok) {
    return {
      text: await response.text(),
      url: normalized.source,
    };
  }

  const authHost = githubAuthHost(normalized.source);
  if (!authHost || ![401, 403, 404].includes(response.status)) {
    throw new BobsterError(`Could not fetch ${source}: HTTP ${response.status}`);
  }

  const token = await githubToken(authHost);
  if (!token) {
    throw new BobsterError(
      `Could not fetch ${source}: HTTP ${response.status}\n\nRun gh auth login -h ${authHost} if this is a private GitHub registry.`,
    );
  }

  const authed = await fetch(normalized.source, {
    headers: {
      ...normalized.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!authed.ok) {
    throw new BobsterError(`Could not fetch ${source}: HTTP ${authed.status}`);
  }

  return {
    text: await authed.text(),
    url: normalized.source,
  };
}

module.exports = {
  fetchHttpText,
  githubBlobInfo,
  githubRepoInfo,
  normalizeHttpSource,
};

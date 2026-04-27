"use strict";

const path = require("node:path");

function stripSshRegistryPrefix(source) {
  return String(source || "").trim().replace(/^ssh\//, "");
}

function registryNameFromRepo(repoName) {
  const baseName = repoName.replace(/\.git$/i, "").replace(/^bobster-registry-/i, "");
  const name = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name || "registry";
}

function parseSshGitRegistrySource(source) {
  const remote = stripSshRegistryPrefix(source);
  const shorthand = remote.match(/^[^@/\s]+@([^:\s]+):(.+)$/);

  if (shorthand) {
    const repoName = path.posix.basename(shorthand[2]).replace(/\.git$/i, "");
    return {
      remote,
      name: registryNameFromRepo(repoName),
      repoName,
    };
  }

  let url;
  try {
    url = new URL(remote);
  } catch {
    return null;
  }

  if (url.protocol !== "ssh:") {
    return null;
  }

  const repoName = path.posix.basename(url.pathname).replace(/\.git$/i, "");
  if (!repoName) {
    return null;
  }

  return {
    remote,
    name: registryNameFromRepo(repoName),
    repoName,
  };
}

module.exports = {
  parseSshGitRegistrySource,
  registryNameFromRepo,
};

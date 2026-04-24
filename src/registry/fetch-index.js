"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { BUNDLED_REGISTRY_INDEX, DEFAULT_REGISTRY } = require("../constants");
const { BobsterError } = require("../error");
const { assertSafeRelativePath } = require("../fs/safe-path");
const { validateIndex } = require("./schemas");

function isHttpSource(source) {
  return /^https?:\/\//i.test(source);
}

function isFileUrl(source) {
  return /^file:\/\//i.test(source);
}

function resolveLocalSource(source, cwd) {
  if (isFileUrl(source)) {
    return fileURLToPath(source);
  }
  return path.isAbsolute(source) ? source : path.resolve(cwd, source);
}

async function readTextSource(source, cwd) {
  if (isHttpSource(source)) {
    if (typeof fetch !== "function") {
      throw new BobsterError("This Node.js runtime does not provide fetch().");
    }

    const response = await fetch(source);
    if (!response.ok) {
      throw new BobsterError(`Could not fetch ${source}: HTTP ${response.status}`);
    }
    return {
      localPath: null,
      text: await response.text(),
      url: source,
    };
  }

  const localPath = resolveLocalSource(source, cwd);
  return {
    localPath,
    text: await fs.readFile(localPath, "utf8"),
    url: pathToFileURL(localPath).href,
  };
}

async function fetchRegistryIndex(registry, options = {}) {
  const cwd = options.cwd || process.cwd();
  let result;
  let usedFallback = false;

  try {
    result = await readTextSource(registry, cwd);
  } catch (error) {
    if (registry !== DEFAULT_REGISTRY) {
      throw error;
    }

    result = await readTextSource(BUNDLED_REGISTRY_INDEX, cwd);
    usedFallback = true;
  }

  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch (error) {
    throw new BobsterError(`Could not parse registry index ${registry}: ${error.message}`);
  }

  const index = validateIndex(parsed);
  const localRegistryRoot = result.localPath ? path.dirname(result.localPath) : null;

  return {
    index,
    localRegistryRoot,
    registry,
    resolvedRegistry: result.url,
    usedFallback,
  };
}

function joinRemoteUrl(baseUrl, ...parts) {
  let current = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  for (const part of parts) {
    current = new URL(part.replace(/^\/+/, ""), current).href;
    if (!current.endsWith("/") && part !== parts.at(-1)) {
      current += "/";
    }
  }
  return current;
}

async function fetchRegistryFile(registryContext, item, file) {
  assertSafeRelativePath(file, "registry file");

  if (registryContext.localRegistryRoot) {
    const localPath = path.join(registryContext.localRegistryRoot, item.path, file);
    return {
      content: await fs.readFile(localPath, "utf8"),
      source: pathToFileURL(localPath).href,
    };
  }

  const baseUrl = registryContext.index.baseUrl;
  if (!baseUrl) {
    throw new BobsterError("Registry index does not define baseUrl.");
  }

  const remoteUrl = joinRemoteUrl(baseUrl, item.path, file);
  try {
    const text = await readTextSource(remoteUrl, process.cwd());
    return {
      content: text.text,
      source: remoteUrl,
    };
  } catch (error) {
    if (!String(baseUrl).startsWith("https://raw.githubusercontent.com/felixpahlke/bobster/")) {
      throw error;
    }

    const localPath = path.join(path.dirname(BUNDLED_REGISTRY_INDEX), item.path, file);
    return {
      content: await fs.readFile(localPath, "utf8"),
      source: pathToFileURL(localPath).href,
    };
  }
}

module.exports = {
  fetchRegistryFile,
  fetchRegistryIndex,
  isHttpSource,
  readTextSource,
};

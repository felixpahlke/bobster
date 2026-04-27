"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { promisify } = require("node:util");
const { BUNDLED_REGISTRY_INDEX, DEFAULT_REGISTRY } = require("../constants");
const { BobsterError } = require("../error");
const { assertSafeRelativePath } = require("../fs/safe-path");
const { parseSshGitRegistrySource } = require("./git-source");
const { validateIndex } = require("./schemas");

const execFileAsync = promisify(execFile);

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

function gitRegistryCacheRoot(env: any = process.env) {
  const cacheHome = env.BOBSTER_CACHE || env.XDG_CACHE_HOME || path.join(env.HOME || os.homedir(), ".cache");
  return path.join(cacheHome, "bobster", "git-registries");
}

function gitRegistryCachePath(sourceInfo, env) {
  const hash = crypto.createHash("sha256").update(sourceInfo.remote).digest("hex").slice(0, 16);
  return path.join(gitRegistryCacheRoot(env), `${sourceInfo.repoName}-${hash}.git`);
}

function gitSourceLabel(sourceInfo) {
  return sourceInfo.remote;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args, sourceInfo) {
  try {
    return await execFileAsync("git", args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    });
  } catch (error) {
    const details = String(error.stderr || error.message || "").trim();
    throw new BobsterError(`Could not access SSH registry ${gitSourceLabel(sourceInfo)}.${details ? `\n${details}` : ""}`);
  }
}

async function ensureGitRegistryCache(sourceInfo, options: any = {}) {
  const env = options.env || process.env;
  const cachePath = gitRegistryCachePath(sourceInfo, env);

  if (!(await pathExists(cachePath))) {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await runGit(
      [
        "clone",
        "--bare",
        "--filter=blob:none",
        "--depth=1",
        sourceInfo.remote,
        cachePath,
      ],
      sourceInfo,
    );
  }

  await runGit(["-C", cachePath, "fetch", "--depth=1", "origin", "HEAD"], sourceInfo);
  const commit = (await runGit(["-C", cachePath, "rev-parse", "FETCH_HEAD"], sourceInfo)).stdout.trim();
  return {
    cachePath,
    commit,
    registryRoot: "registry",
    source: sourceInfo,
  };
}

function joinGitPath(...parts) {
  return parts
    .flatMap((part) => String(part || "").split("/"))
    .filter(Boolean)
    .join("/");
}

async function readGitRegistryBlob(gitRegistry, relativePath) {
  const objectPath = joinGitPath(gitRegistry.registryRoot, relativePath);
  const result = await runGit(
    ["-C", gitRegistry.cachePath, "show", `${gitRegistry.commit}:${objectPath}`],
    gitRegistry.source,
  );
  return {
    text: result.stdout,
    url: `${gitRegistry.source.remote}#${gitRegistry.commit}:${objectPath}`,
  };
}

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

async function readTextSource(source, cwd, options: any = {}) {
  const sshSource = parseSshGitRegistrySource(source);
  if (sshSource) {
    const gitRegistry = await ensureGitRegistryCache(sshSource, options);
    const result = await readGitRegistryBlob(gitRegistry, "index.json");
    return {
      gitRegistry,
      localPath: null,
      text: result.text,
      url: result.url,
    };
  }

  if (isHttpSource(source)) {
    const result = await fetchHttpText(source);
    return {
      gitRegistry: null,
      localPath: null,
      text: result.text,
      url: result.url,
    };
  }

  const localPath = resolveLocalSource(source, cwd);
  return {
    gitRegistry: null,
    localPath,
    text: await fs.readFile(localPath, "utf8"),
    url: pathToFileURL(localPath).href,
  };
}

async function fetchRegistryIndex(registry: string, options: any = {}) {
  const cwd = options.cwd || process.cwd();
  let result;
  let usedFallback = false;

  try {
    result = await readTextSource(registry, cwd, options);
  } catch (error) {
    if (registry !== DEFAULT_REGISTRY) {
      throw error;
    }

    result = await readTextSource(BUNDLED_REGISTRY_INDEX, cwd, options);
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
    gitRegistry: result.gitRegistry,
    index,
    localRegistryRoot,
    registry,
    resolvedRegistry: result.url,
    usedFallback,
  };
}

function annotateRegistryItem(item, registry, includeRegistry) {
  const annotated = {
    ...item,
    registry: registry.name,
  };
  Object.defineProperty(annotated, "_includeRegistry", {
    enumerable: false,
    value: includeRegistry,
  });
  return annotated;
}

async function fetchRegistryIndexes(registries: any[], options: any = {}) {
  const contexts = [];
  for (const registry of registries) {
    const context: any = await fetchRegistryIndex(registry.url, options);
    context.name = registry.name;
    context.registryUrl = registry.url;
    contexts.push(context);
  }

  const includeRegistry = contexts.length > 1;
  const items = contexts.flatMap((context) =>
    context.index.items.map((item) =>
      annotateRegistryItem(item, { name: context.name }, includeRegistry),
    ),
  );
  const registryByName = new Map(contexts.map((context) => [context.name, context]));

  return {
    index: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      items,
    },
    registries: contexts,
    registry: contexts.length === 1 ? contexts[0].registry : "multiple",
    registryByName,
    resolvedRegistry: contexts.length === 1 ? contexts[0].resolvedRegistry : null,
    usedFallback: contexts.some((context) => context.usedFallback),
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

function contextForItem(registryContext, item) {
  if (!registryContext.registryByName || !item.registry) {
    return registryContext;
  }
  return registryContext.registryByName.get(item.registry) || registryContext;
}

async function fetchRegistryFile(registryContext, item, file) {
  assertSafeRelativePath(file, "registry file");
  const sourceContext = contextForItem(registryContext, item);

  if (sourceContext.localRegistryRoot) {
    const localPath = path.join(sourceContext.localRegistryRoot, item.path, file);
    return {
      content: await fs.readFile(localPath, "utf8"),
      source: pathToFileURL(localPath).href,
    };
  }

  if (sourceContext.gitRegistry) {
    const result = await readGitRegistryBlob(
      sourceContext.gitRegistry,
      joinGitPath(item.path, file),
    );
    return {
      content: result.text,
      source: result.url,
    };
  }

  const baseUrl = sourceContext.index.baseUrl;
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
  contextForItem,
  fetchRegistryIndexes,
  fetchRegistryFile,
  fetchRegistryIndex,
  githubBlobInfo,
  isHttpSource,
  readTextSource,
};

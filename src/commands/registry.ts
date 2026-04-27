"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { BobsterError } = require("../error");
const { defaultConfig, defaultRegistries, resolveConfigPath } = require("../config/defaults");
const { configuredRegistries, readJsonIfExists } = require("../config/load-config");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { writeRegistryIndex } = require("../registry/build-index");

const execFileAsync = promisify(execFile);
const PRIVATE_REGISTRIES_DIR = ".private-registries";

function assertRegistryName(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(name || ""))) {
    throw new BobsterError("Registry name must be lowercase kebab-case.");
  }
}

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
  const normalized = stripSshRegistryPrefix(source);
  const shorthand = normalized.match(/^[^@/\s]+@([^:\s]+):(.+)$/);

  if (shorthand) {
    const repoName = path.posix.basename(shorthand[2]).replace(/\.git$/i, "");
    return {
      cloneUrl: normalized,
      name: registryNameFromRepo(repoName),
      repoName,
    };
  }

  let url;
  try {
    url = new URL(normalized);
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
    cloneUrl: normalized,
    name: registryNameFromRepo(repoName),
    repoName,
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureSshGitRegistryCheckout(cwd, sourceInfo) {
  const relativeCheckoutPath = path.join(PRIVATE_REGISTRIES_DIR, sourceInfo.repoName);
  const checkoutPath = path.join(cwd, relativeCheckoutPath);
  const indexPath = path.join(relativeCheckoutPath, "registry", "index.json");
  const absoluteIndexPath = path.join(cwd, indexPath);

  if (await pathExists(checkoutPath)) {
    if (!(await pathExists(absoluteIndexPath))) {
      throw new BobsterError(`Existing checkout is missing ${indexPath}.`);
    }
    return indexPath;
  }

  await fs.mkdir(path.dirname(checkoutPath), { recursive: true });
  try {
    await execFileAsync("git", ["clone", sourceInfo.cloneUrl, checkoutPath], {
      timeout: 120000,
    });
  } catch (error) {
    const details = String(error.stderr || error.message || "").trim();
    throw new BobsterError(`Could not clone SSH registry ${sourceInfo.cloneUrl}.${details ? `\n${details}` : ""}`);
  }

  if (!(await pathExists(absoluteIndexPath))) {
    throw new BobsterError(`Cloned registry is missing ${indexPath}.`);
  }

  return indexPath;
}

async function readProjectConfig(cwd) {
  const configPath = resolveConfigPath(cwd);
  const fileConfig = readJsonIfExists(configPath);
  if (fileConfig) {
    return {
      config: fileConfig,
      configPath,
    };
  }
  return {
    config: defaultConfig(),
    configPath,
  };
}

async function writeProjectConfig(configPath, config) {
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function ensureRegistries(config) {
  if (Array.isArray(config.registries) && config.registries.length) {
    return configuredRegistries(config);
  }
  return defaultRegistries(config.registry);
}

async function addRegistry(context) {
  const { args, cwd, flags, io } = context;
  const nameOrSource = args[1];
  const explicitUrl = args[2];
  if (!nameOrSource) {
    throw new BobsterError("Usage: bobster registry add <name> <url>\n       bobster registry add ssh/git@host:owner/repo.git");
  }

  let name = nameOrSource;
  let url = explicitUrl;
  const sshSource = explicitUrl
    ? parseSshGitRegistrySource(explicitUrl)
    : parseSshGitRegistrySource(nameOrSource);

  if (sshSource) {
    name = explicitUrl ? nameOrSource : sshSource.name;
    assertRegistryName(name);
    url = await ensureSshGitRegistryCheckout(cwd, sshSource);
  }

  if (!url) {
    throw new BobsterError("Usage: bobster registry add <name> <url>\n       bobster registry add ssh/git@host:owner/repo.git");
  }
  assertRegistryName(name);

  const { config, configPath } = await readProjectConfig(cwd);
  const registries = ensureRegistries(config);
  const existing = registries.find((registry) => registry.name === name);
  if (existing && existing.url !== url && !flags.force) {
    throw new BobsterError(`Registry "${name}" already exists. Use --force to replace it.`);
  }

  config.registries = [
    ...registries.filter((registry) => registry.name !== name),
    { name, url },
  ];
  await writeProjectConfig(configPath, config);

  if (flags.json) {
    io.out(JSON.stringify({ registries: config.registries }, null, 2));
    return;
  }
  io.out(existing ? `Updated registry ${name}.` : `Added registry ${name}.`);
}

async function listRegistries(context) {
  const { cwd, flags, io } = context;
  const { config } = await readProjectConfig(cwd);
  const registries = ensureRegistries(config);
  if (flags.json) {
    io.out(JSON.stringify(registries, null, 2));
    return;
  }
  io.out(registries.map((registry) => `${registry.name.padEnd(12)}  ${registry.url}`).join("\n"));
}

async function removeRegistry(context) {
  const { args, cwd, flags, io } = context;
  const name = args[1];
  if (!name) {
    throw new BobsterError("Usage: bobster registry remove <name>");
  }

  const { config, configPath } = await readProjectConfig(cwd);
  const registries = ensureRegistries(config);
  const nextRegistries = registries.filter((registry) => registry.name !== name);
  if (nextRegistries.length === registries.length) {
    throw new BobsterError(`Registry "${name}" is not configured.`);
  }
  if (!nextRegistries.length) {
    throw new BobsterError("Cannot remove the last configured registry.");
  }

  config.registries = nextRegistries;
  await writeProjectConfig(configPath, config);

  if (flags.json) {
    io.out(JSON.stringify({ registries: config.registries }, null, 2));
    return;
  }
  io.out(`Removed registry ${name}.`);
}

async function doctorRegistry(context) {
  const { args, cwd, flags, io } = context;
  const requestedName = args[1] || null;
  const { config } = await readProjectConfig(cwd);
  const registries = ensureRegistries(config).filter((registry) => !requestedName || registry.name === requestedName);

  if (!registries.length) {
    throw new BobsterError(`Registry "${requestedName}" is not configured.`);
  }

  const results = [];
  for (const registry of registries) {
    try {
      const registryContext = await fetchRegistryIndex(registry.url, { cwd });
      results.push({
        items: registryContext.index.items.length,
        name: registry.name,
        ok: true,
        resolved: registryContext.resolvedRegistry,
        url: registry.url,
      });
    } catch (error) {
      results.push({
        error: error.message,
        name: registry.name,
        ok: false,
        url: registry.url,
      });
    }
  }

  if (flags.json) {
    io.out(JSON.stringify(results, null, 2));
    return;
  }

  io.out(
    results
      .map((result) =>
        result.ok
          ? `${result.name}: ok (${result.items} items)`
          : `${result.name}: failed\n  ${result.error}`,
      )
      .join("\n"),
  );
}

async function runRegistry(context) {
  const { args, flags, io } = context;
  const action = args[0];

  if (action === "add") {
    await addRegistry(context);
    return;
  }
  if (action === "list") {
    await listRegistries(context);
    return;
  }
  if (action === "remove") {
    await removeRegistry(context);
    return;
  }
  if (action === "doctor") {
    await doctorRegistry(context);
    return;
  }

  if (action !== "build" && action !== "validate") {
    throw new BobsterError("Usage: bobster registry <add|list|remove|doctor|build|validate> [options]");
  }

  const result = await writeRegistryIndex({
    baseUrl: flags.baseUrl,
    check: flags.check || action === "validate",
  });

  if (flags.json) {
    io.out(JSON.stringify(result.index, null, 2));
    return;
  }

  if (result.checked) {
    io.out("Registry index is valid.");
  } else {
    io.out(`Wrote ${result.indexPath}.`);
  }
}

module.exports = {
  parseSshGitRegistrySource,
  runRegistry,
};

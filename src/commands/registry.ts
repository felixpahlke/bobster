"use strict";

const fs = require("node:fs/promises");
const { BobsterError } = require("../error");
const { defaultConfig, defaultRegistries, resolveConfigPath } = require("../config/defaults");
const { configuredRegistries, readJsonIfExists } = require("../config/load-config");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { writeRegistryIndex } = require("../registry/build-index");

function assertRegistryName(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(name || ""))) {
    throw new BobsterError("Registry name must be lowercase kebab-case.");
  }
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
  const name = args[1];
  const url = args[2];
  if (!name || !url) {
    throw new BobsterError("Usage: bobster registry add <name> <url>");
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
  runRegistry,
};

"use strict";

const { BobsterError } = require("../error");
const {
  readGlobalConfig,
  writeGlobalConfig,
} = require("../config/global-config");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { writeRegistryIndex } = require("../registry/build-index");
const { configuredRegistries } = require("../config/registries");
const { parseSshGitRegistrySource } = require("../registry/git-source");
const { withSpinner } = require("../spinner");

function assertRegistryName(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(name || ""))) {
    throw new BobsterError("Registry name must be lowercase kebab-case.");
  }
}

async function addRegistry(context) {
  const { args, env, flags, io } = context;
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
    url = sshSource.remote;
  }

  if (!url) {
    throw new BobsterError("Usage: bobster registry add <name> <url>\n       bobster registry add ssh/git@host:owner/repo.git");
  }
  assertRegistryName(name);

  const { config, configPath } = await readGlobalConfig(env);
  const registries = configuredRegistries(config);
  const existing = registries.find((registry) => registry.name === name);
  if (existing && existing.url !== url && !flags.force) {
    throw new BobsterError(`Registry "${name}" already exists. Use --force to replace it.`);
  }

  config.registries = [
    ...registries.filter((registry) => registry.name !== name),
    { name, url },
  ];
  await writeGlobalConfig(configPath, config);

  if (flags.json) {
    io.out(JSON.stringify({ registries: config.registries }, null, 2));
    return;
  }
  io.out(existing ? `Updated registry ${name}.` : `Added registry ${name}.`);
}

async function listRegistries(context) {
  const { env, flags, io } = context;
  const { config } = await readGlobalConfig(env);
  const registries = configuredRegistries(config);
  if (flags.json) {
    io.out(JSON.stringify(registries, null, 2));
    return;
  }
  io.out(registries.map((registry) => `${registry.name.padEnd(12)}  ${registry.url}`).join("\n"));
}

async function removeRegistry(context) {
  const { args, env, flags, io } = context;
  const name = args[1];
  if (!name) {
    throw new BobsterError("Usage: bobster registry remove <name>");
  }

  const { config, configPath } = await readGlobalConfig(env);
  const registries = configuredRegistries(config);
  const nextRegistries = registries.filter((registry) => registry.name !== name);
  if (nextRegistries.length === registries.length) {
    throw new BobsterError(`Registry "${name}" is not configured.`);
  }
  if (!nextRegistries.length) {
    throw new BobsterError("Cannot remove the last configured registry.");
  }

  config.registries = nextRegistries;
  await writeGlobalConfig(configPath, config);

  if (flags.json) {
    io.out(JSON.stringify({ registries: config.registries }, null, 2));
    return;
  }
  io.out(`Removed registry ${name}.`);
}

async function doctorRegistry(context) {
  const { args, cwd, env, flags, io } = context;
  const requestedName = args[1] || null;
  const { config } = await readGlobalConfig(env);
  const registries = configuredRegistries(config).filter((registry) => !requestedName || registry.name === requestedName);

  if (!registries.length) {
    throw new BobsterError(`Registry "${requestedName}" is not configured.`);
  }

  const results = [];
  for (const registry of registries) {
    try {
      const registryContext = await withSpinner(context, `Checking registry ${registry.name}...`, () =>
        fetchRegistryIndex(registry.url, { cwd, env }),
      );
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

"use strict";

const { DEFAULT_REGISTRY } = require("../constants");
const { BobsterError } = require("../error");
const { defaultRegistries } = require("./defaults");

function isRegistryName(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
}

function normalizeRegistryEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new BobsterError("registries entries must be objects with name and url.");
  }

  const name = String(entry.name || "").trim();
  const url = String(entry.url || "").trim();
  if (!isRegistryName(name)) {
    throw new BobsterError("registry name must be lowercase kebab-case.");
  }
  if (!url) {
    throw new BobsterError(`registry ${name} is missing a url.`);
  }

  return {
    name,
    url,
  };
}

function configuredRegistries(config) {
  if (Array.isArray(config.registries) && config.registries.length) {
    const registries = config.registries.map(normalizeRegistryEntry);
    const names = new Set();
    for (const registry of registries) {
      if (names.has(registry.name)) {
        throw new BobsterError(`Duplicate registry name: ${registry.name}`);
      }
      names.add(registry.name);
    }
    return registries;
  }

  return defaultRegistries(DEFAULT_REGISTRY);
}

function selectedRegistries(registries, flags) {
  if (!flags.registry) {
    return registries;
  }

  const selected = registries.find((registry) => registry.name === flags.registry);
  if (selected) {
    return [selected];
  }

  return [
    {
      name: isRegistryName(flags.registry) ? flags.registry : "override",
      url: flags.registry,
    },
  ];
}

module.exports = {
  configuredRegistries,
  isRegistryName,
  normalizeRegistryEntry,
  selectedRegistries,
};

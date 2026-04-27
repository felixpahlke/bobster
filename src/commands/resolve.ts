"use strict";

const { BobsterError } = require("../error");
const { canPrompt, selectItem } = require("../prompt");
const {
  parseQualifiedName,
  resolveInstalledItem,
  resolveRegistryItem,
  suggestRegistryItems,
} = require("../registry/resolve-item");
const { normalizeType } = require("../registry/schemas");

function requestedTypeForName(name, flags) {
  const parsed = parseQualifiedName(name);
  return flags.type ? normalizeType(flags.type) : parsed.type;
}

async function resolveRegistryItemForCommand(context, registryContext, name, options: any = {}) {
  try {
    return resolveRegistryItem(registryContext.index, name, { type: context.flags.type });
  } catch (error) {
    if (!canPrompt(context) || !(error instanceof BobsterError) || !error.message.startsWith("No registry item found")) {
      throw error;
    }

    const parsed = parseQualifiedName(name);
    const suggestions = suggestRegistryItems(registryContext.index.items, parsed.name, {
      registry: parsed.registry,
      type: requestedTypeForName(name, context.flags),
    });
    const selected = await selectItem(options.message || "Did you mean one of these?", suggestions, {
      input: context.io.stdin,
      output: context.io.stderr,
    });
    if (!selected) {
      throw error;
    }
    return selected;
  }
}

async function resolveInstalledItemForCommand(context, lockfile, name, options: any = {}) {
  try {
    return resolveInstalledItem(lockfile, name, { type: context.flags.type });
  } catch (error) {
    if (!canPrompt(context) || !(error instanceof BobsterError) || !error.message.startsWith("No installed item found")) {
      throw error;
    }

    const parsed = parseQualifiedName(name);
    const suggestions = suggestRegistryItems(lockfile.items || [], parsed.name, {
      registry: parsed.registry,
      type: requestedTypeForName(name, context.flags),
    });
    const selected = await selectItem(options.message || "Did you mean one of these?", suggestions, {
      input: context.io.stdin,
      output: context.io.stderr,
    });
    if (!selected) {
      throw error;
    }
    return selected;
  }
}

async function selectRegistryItemForCommand(context, items, options: any = {}) {
  if (!canPrompt(context) || !items.length) {
    return null;
  }

  return selectItem(options.message || "Select an item", items, {
    input: context.io.stdin,
    output: context.io.stderr,
  });
}

module.exports = {
  resolveInstalledItemForCommand,
  resolveRegistryItemForCommand,
  selectRegistryItemForCommand,
};

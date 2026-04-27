"use strict";

const { BobsterError } = require("../error");
const { itemId } = require("../output");
const { canPrompt, selectItem } = require("../prompt");
const {
  parseQualifiedName,
  resolveInstalledItem,
  resolveRegistryItem,
  suggestRegistryItems,
} = require("../registry/resolve-item");
const { searchItems } = require("../registry/search-items");
const { normalizeType } = require("../registry/schemas");

function requestedTypeForName(name, flags) {
  const parsed = parseQualifiedName(name);
  return flags.type ? normalizeType(flags.type) : parsed.type;
}

function canSelect(context, options: any = {}) {
  return options.canPrompt ? options.canPrompt(context) : canPrompt(context);
}

function isBareRegistryQuery(name) {
  const parsed = parseQualifiedName(name);
  return Boolean(parsed.name && !parsed.registry && !parsed.type);
}

function uniqueItems(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = itemId(item, { includeRegistry: Boolean(item.registry) });
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

function searchMatchesForBareRegistryQuery(index, name, options: any = {}) {
  if (!isBareRegistryQuery(name)) {
    return [];
  }

  const parsed = parseQualifiedName(name);
  return searchItems(index.items, parsed.name, { type: options.type }).slice(0, options.limit || 10);
}

async function resolveRegistryItemForCommand(context, registryContext, name, options: any = {}) {
  let resolved;
  try {
    resolved = resolveRegistryItem(registryContext.index, name, { type: context.flags.type });
  } catch (error) {
    if (!canSelect(context, options) || !(error instanceof BobsterError) || !error.message.startsWith("No registry item found")) {
      throw error;
    }

    const parsed = parseQualifiedName(name);
    const suggestions = suggestRegistryItems(registryContext.index.items, parsed.name, {
      registry: parsed.registry,
      type: requestedTypeForName(name, context.flags),
    });
    const pickItem = options.selectItem || selectItem;
    const selected = await pickItem(options.message || "Did you mean one of these?", suggestions, {
      input: context.io.stdin,
      output: context.io.stderr,
    });
    if (!selected) {
      throw error;
    }
    return selected;
  }

  if (options.searchBareName && canSelect(context, options)) {
    const searchMatches = searchMatchesForBareRegistryQuery(registryContext.index, name, {
      limit: options.searchLimit,
      type: requestedTypeForName(name, context.flags),
    });
    const resolvedKey = itemId(resolved, { includeRegistry: Boolean(resolved.registry) });
    const hasAlternatives = searchMatches.some((item) => itemId(item, { includeRegistry: Boolean(item.registry) }) !== resolvedKey);

    if (hasAlternatives) {
      const pickItem = options.selectItem || selectItem;
      const selected = await pickItem(options.message || "Select an item", uniqueItems([resolved, ...searchMatches]), {
        input: context.io.stdin,
        output: context.io.stderr,
        searchable: options.searchable,
      });
      if (selected) {
        return selected;
      }
    }
  }

  return resolved;
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
    searchable: options.searchable,
  });
}

module.exports = {
  resolveInstalledItemForCommand,
  resolveRegistryItemForCommand,
  searchMatchesForBareRegistryQuery,
  selectRegistryItemForCommand,
};

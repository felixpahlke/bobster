"use strict";

const path = require("node:path");
const { assertSafeRelativePath, resolveProjectPath, toDisplayPath } = require("../fs/safe-path");
const {
  addPlannedWrite,
  createWritePlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { fetchRegistryFile } = require("../registry/fetch-index");
const { contextForItem } = require("../registry/fetch-index");
const { extractModeSlug, mergeModeYaml } = require("../modes/custom-modes");

function targetFileForSkill(config, item, file) {
  assertSafeRelativePath(file, "registry file");
  return resolveProjectPath(config.cwd, path.join(config.paths.skills, item.name, file));
}

function installsRuleAsDirectory(item) {
  return item.files.length > 1 || item.files.some((file) => file.includes("/"));
}

function targetFileForRule(config, item, file = item.entry) {
  assertSafeRelativePath(file, "registry file");
  if (installsRuleAsDirectory(item)) {
    return resolveProjectPath(config.cwd, path.join(config.paths.rules, item.name, file));
  }
  return resolveProjectPath(config.cwd, path.join(config.paths.rules, `${item.name}.md`));
}

function targetFileForMode(config) {
  return resolveProjectPath(config.cwd, config.paths.modes);
}

function lockEntryForItem(config: any, registryContext: any, item: any, files: string[], extra: any = {}) {
  const sourceContext = contextForItem(registryContext, item);
  const baseUrl = sourceContext.index.baseUrl || sourceContext.resolvedRegistry;
  return {
    type: item.type,
    name: item.name,
    version: item.version,
    source: `${baseUrl}/${item.path}`,
    registry: item.registry || sourceContext.name || sourceContext.registry,
    files,
    ...extra,
  };
}

async function planInstall(config: any, registryContext: any, item: any, options: any = {}) {
  const plan = createWritePlan();

  if (item.type === "skill") {
    const files = [];
    for (const file of item.files) {
      const payload = await fetchRegistryFile(registryContext, item, file);
      const target = targetFileForSkill(config, item, file);
      files.push(toDisplayPath(config.cwd, target));
      await addPlannedWrite(plan, config.cwd, target, payload.content, {
        allowOverwrite: options.allowOverwrite,
        item,
      });
    }

    return {
      lockEntry: lockEntryForItem(config, registryContext, item, files),
      plan,
    };
  }

  if (item.type === "rule") {
    const files = [];
    const registryFiles = installsRuleAsDirectory(item) ? item.files : [item.entry];

    for (const file of registryFiles) {
      const payload = await fetchRegistryFile(registryContext, item, file);
      const target = targetFileForRule(config, item, file);
      files.push(toDisplayPath(config.cwd, target));
      await addPlannedWrite(plan, config.cwd, target, payload.content, {
        allowOverwrite: options.allowOverwrite,
        item,
      });
    }

    return {
      lockEntry: lockEntryForItem(config, registryContext, item, files),
      plan,
    };
  }

  const payload = await fetchRegistryFile(registryContext, item, item.entry);
  const target = targetFileForMode(config);
  const existing = await readFileIfExists(target);
  const modeSlug = extractModeSlug(payload.content);
  const merged = mergeModeYaml(existing, payload.content, {
    allowOverwrite: options.allowOverwrite,
  });
  const files = [toDisplayPath(config.cwd, target)];

  if (merged.conflict) {
    plan.conflicts.push({
      content: merged.content,
      current: merged.currentBlock,
      displayPath: toDisplayPath(config.cwd, target),
      item,
      path: target,
    });
  } else if (merged.changed) {
    await addPlannedWrite(plan, config.cwd, target, merged.content, {
      allowOverwrite: true,
      item,
    });
  } else {
    plan.unchanged.push({
      content: merged.content,
      displayPath: toDisplayPath(config.cwd, target),
      item,
      path: target,
    });
  }

  return {
    lockEntry: lockEntryForItem(config, registryContext, item, files, { modeSlug }),
    plan,
  };
}

module.exports = {
  installsRuleAsDirectory,
  planInstall,
  targetFileForMode,
  targetFileForRule,
  targetFileForSkill,
};

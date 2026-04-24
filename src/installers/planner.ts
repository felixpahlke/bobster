"use strict";

const path = require("node:path");
const { assertSafeRelativePath, resolveProjectPath, toDisplayPath } = require("../fs/safe-path");
const {
  addPlannedWrite,
  createWritePlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { fetchRegistryFile } = require("../registry/fetch-index");
const { extractModeSlug, mergeModeYaml } = require("../modes/custom-modes");

function targetFileForSkill(config, item, file) {
  assertSafeRelativePath(file, "registry file");
  return resolveProjectPath(config.cwd, path.join(config.paths.skills, item.name, file));
}

function targetFileForRule(config, item) {
  return resolveProjectPath(config.cwd, path.join(config.paths.rules, `${item.name}.md`));
}

function targetFileForMode(config) {
  return resolveProjectPath(config.cwd, config.paths.modes);
}

function lockEntryForItem(config: any, registryContext: any, item: any, files: string[], extra: any = {}) {
  return {
    type: item.type,
    name: item.name,
    version: item.version,
    source: `${registryContext.index.baseUrl || registryContext.resolvedRegistry}/${item.path}`,
    registry: registryContext.registry,
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
    const payload = await fetchRegistryFile(registryContext, item, item.entry);
    const target = targetFileForRule(config, item);
    const files = [toDisplayPath(config.cwd, target)];
    await addPlannedWrite(plan, config.cwd, target, payload.content, {
      allowOverwrite: options.allowOverwrite,
      item,
    });

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
  planInstall,
  targetFileForMode,
  targetFileForRule,
  targetFileForSkill,
};

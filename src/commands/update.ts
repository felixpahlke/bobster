"use strict";

const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const { appendPlan, applyWritePlan, createWritePlan, formatPlan, hasChanges } = require("../fs/write-plan");
const { readLockfile, upsertLockItem, writeLockfile } = require("../lockfile/lockfile");
const { formatItemId } = require("../output");
const { confirm } = require("../prompt");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { resolveInstalledItem, resolveRegistryItem } = require("../registry/resolve-item");
const { planInstall } = require("../installers/planner");

async function runUpdate(context) {
  const { args, cwd, flags, io } = context;
  const config = loadConfig(cwd, flags);
  const lockfile = await readLockfile(cwd);

  if (!lockfile.items.length) {
    throw new BobsterError("No installed items found.");
  }

  const installedItems = args[0]
    ? [resolveInstalledItem(lockfile, args[0], { type: flags.type })]
    : lockfile.items;
  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  const aggregatePlan = createWritePlan();
  const nextLockItems = [];

  for (const installed of installedItems) {
    const item = resolveRegistryItem(registryContext.index, `${installed.type}/${installed.name}`);
    const install = await planInstall(config, registryContext, item, {
      allowOverwrite: true,
    });
    appendPlan(aggregatePlan, install.plan);
    nextLockItems.push(install.lockEntry);
  }

  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          items: installedItems,
          plan: {
            creates: aggregatePlan.creates.map((entry) => entry.displayPath),
            updates: aggregatePlan.updates.map((entry) => entry.displayPath),
            unchanged: aggregatePlan.unchanged.map((entry) => entry.displayPath),
            conflicts: aggregatePlan.conflicts.map((entry) => entry.displayPath),
          },
        },
        null,
        2,
      ),
    );
  } else {
    io.out(
      args[0]
        ? `Update ${formatItemId(installedItems[0], context.theme)}?`
        : `Update ${installedItems.length} installed item${installedItems.length === 1 ? "" : "s"}?`,
    );
    const planText = formatPlan(aggregatePlan, { theme: context.theme });
    io.out(planText || "All installed items are up to date.");
  }

  if (flags.dryRun) {
    return;
  }

  if (hasChanges(aggregatePlan) && !flags.yes) {
    const accepted = await confirm("Proceed?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Update cancelled.");
    }
  }

  await applyWritePlan(aggregatePlan, { forceConflicts: true });
  lockfile.registry = config.registry;
  for (const lockEntry of nextLockItems) {
    upsertLockItem(lockfile, lockEntry);
  }
  await writeLockfile(cwd, lockfile);

  if (!flags.json) {
    io.out(hasChanges(aggregatePlan) ? "Update complete." : "Nothing to update.");
  }
}

module.exports = {
  runUpdate,
};

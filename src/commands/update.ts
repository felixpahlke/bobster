"use strict";

const { BobsterError } = require("../error");
const { appendPlan, createWritePlan, formatPlan, hasChanges, planPaths } = require("../fs/write-plan");
const { readLockfile, upsertLockItem, writeLockfile } = require("../lockfile/lockfile");
const { formatItemId } = require("../output");
const { resolveRegistryItem } = require("../registry/resolve-item");
const { planInstall } = require("../installers/planner");
const { loadRegistryCommandContext } = require("./context");
const { runPlannedOperation } = require("./planned-operation");
const { resolveInstalledItemForCommand } = require("./resolve");
const { withSpinner } = require("../spinner");

async function runUpdate(context) {
  const { args, cwd, flags, io } = context;
  const { config, registryContext } = await loadRegistryCommandContext(context);
  const lockfile = await readLockfile(cwd);

  if (!lockfile.items.length) {
    throw new BobsterError("No installed items found.");
  }

  const installedItems = args[0]
    ? [
      await resolveInstalledItemForCommand(context, lockfile, args[0], {
        message: "Did you mean one of these? Select an item to update",
      }),
    ]
    : lockfile.items;
  const aggregatePlan = createWritePlan();
  const nextLockItems = [];

  await withSpinner(context, "Preparing update plan...", async () => {
    for (const installed of installedItems) {
      const registryPrefix = installed.registry && registryContext.registryByName?.has(installed.registry)
        ? `${installed.registry}/`
        : "";
      const item = resolveRegistryItem(registryContext.index, `${registryPrefix}${installed.type}/${installed.name}`);
      const install = await planInstall(config, registryContext, item, {
        allowOverwrite: true,
      });
      appendPlan(aggregatePlan, install.plan);
      nextLockItems.push(install.lockEntry);
    }
  });

  await runPlannedOperation(context, {
    plan: aggregatePlan,
    json: {
      items: installedItems,
      plan: planPaths(aggregatePlan, ["creates", "updates", "unchanged", "conflicts"]),
    },
    print() {
      io.out(
        args[0]
          ? `Update ${formatItemId(installedItems[0], context.theme)}?`
          : `Update ${installedItems.length} installed item${installedItems.length === 1 ? "" : "s"}?`,
      );
      const planText = formatPlan(aggregatePlan, { theme: context.theme });
      io.out(planText || "All installed items are up to date.");
    },
    confirmSteps: () => hasChanges(aggregatePlan) && !flags.yes
      ? [{ message: "Proceed?", cancelMessage: "Update cancelled." }]
      : [],
    async afterApply() {
      lockfile.registry = config.registry;
      for (const lockEntry of nextLockItems) {
        upsertLockItem(lockfile, lockEntry);
      }
      await writeLockfile(cwd, lockfile);
    },
    successMessage: () => hasChanges(aggregatePlan) ? "Update complete." : "Nothing to update.",
  });
}

module.exports = {
  runUpdate,
};

"use strict";

const { BobsterError } = require("../error");
const { formatPlan, hasChanges } = require("../fs/write-plan");
const { readLockfile, upsertLockItem, writeLockfile } = require("../lockfile/lockfile");
const { formatItemId } = require("../output");
const { planInstall } = require("../installers/planner");
const { loadRegistryCommandContext } = require("./context");
const { runPlannedOperation } = require("./planned-operation");
const { resolveRegistryItemForCommand } = require("./resolve");

async function installRegistryItem(context: any, config: any, registryContext: any, item: any) {
  const { flags, io } = context;
  const install = await planInstall(config, registryContext, item, {
    allowOverwrite: flags.force,
  });

  await runPlannedOperation(context, {
    plan: install.plan,
    json: {
      item,
      plan: {
        creates: install.plan.creates.map((entry) => entry.displayPath),
        updates: install.plan.updates.map((entry) => entry.displayPath),
        unchanged: install.plan.unchanged.map((entry) => entry.displayPath),
        conflicts: install.plan.conflicts.map((entry) => entry.displayPath),
      },
    },
    print() {
      io.out(`Install ${formatItemId(item, context.theme)}?`);
      const planText = formatPlan(install.plan, { theme: context.theme });
      if (planText) {
        io.out("");
        io.out(planText);
      }
    },
    confirmSteps: () => {
      if (install.plan.conflicts.length && !flags.force) {
        return [{ message: "Overwrite conflicting files?", cancelMessage: "Install cancelled." }];
      }
      if (!flags.yes && hasChanges(install.plan)) {
        return [{ message: "Proceed?", cancelMessage: "Install cancelled." }];
      }
      return [];
    },
    async afterApply() {
      const lockfile = await readLockfile(config.cwd);
      lockfile.registry = config.registry;
      upsertLockItem(lockfile, install.lockEntry);
      await writeLockfile(config.cwd, lockfile);
    },
    successMessage: () => hasChanges(install.plan)
      ? `Installed ${formatItemId(item, context.theme)}.`
      : `${formatItemId(item, context.theme)} is already installed.`,
  });
}

async function runAdd(context: any, options: any = {}) {
  const { args } = context;
  const rawName = args[0];
  if (!rawName) {
    throw new BobsterError(`Usage: bobster ${options.commandName || "add"} <name>`);
  }

  const name = options.forceType && !rawName.includes("/") ? `${options.forceType}/${rawName}` : rawName;
  const { config, registryContext } = await loadRegistryCommandContext(context);
  const item = await resolveRegistryItemForCommand(context, registryContext, name, {
    message: "Did you mean one of these? Select an item to add",
  });
  await installRegistryItem(context, config, registryContext, item);
}

module.exports = {
  installRegistryItem,
  runAdd,
};

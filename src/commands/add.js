"use strict";

const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const { applyWritePlan, formatPlan, hasChanges } = require("../fs/write-plan");
const { readLockfile, upsertLockItem, writeLockfile } = require("../lockfile/lockfile");
const { formatItemId } = require("../output");
const { confirm } = require("../prompt");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { resolveRegistryItem } = require("../registry/resolve-item");
const { planInstall } = require("../installers/planner");

async function runAdd(context, options = {}) {
  const { args, cwd, flags, io } = context;
  const rawName = args[0];
  if (!rawName) {
    throw new BobsterError(`Usage: bobster ${options.commandName || "add"} <name>`);
  }

  const name = options.forceType && !rawName.includes("/") ? `${options.forceType}/${rawName}` : rawName;
  const config = loadConfig(cwd, flags);
  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  const item = resolveRegistryItem(registryContext.index, name, { type: flags.type });
  const install = await planInstall(config, registryContext, item, {
    allowOverwrite: flags.force,
  });

  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          item,
          plan: {
            creates: install.plan.creates.map((entry) => entry.displayPath),
            updates: install.plan.updates.map((entry) => entry.displayPath),
            unchanged: install.plan.unchanged.map((entry) => entry.displayPath),
            conflicts: install.plan.conflicts.map((entry) => entry.displayPath),
          },
        },
        null,
        2,
      ),
    );
  } else {
    io.out(`Install ${formatItemId(item, context.theme)}?`);
    const planText = formatPlan(install.plan, { theme: context.theme });
    if (planText) {
      io.out("");
      io.out(planText);
    }
  }

  if (flags.dryRun) {
    return;
  }

  if (install.plan.conflicts.length && !flags.force) {
    const accepted = await confirm("Overwrite conflicting files?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Install cancelled.");
    }
  } else if (!flags.yes && hasChanges(install.plan)) {
    const accepted = await confirm("Proceed?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Install cancelled.");
    }
  }

  await applyWritePlan(install.plan, { forceConflicts: true });

  const lockfile = await readLockfile(cwd);
  lockfile.registry = config.registry;
  upsertLockItem(lockfile, install.lockEntry);
  await writeLockfile(cwd, lockfile);

  if (!flags.json) {
    io.out(
      hasChanges(install.plan)
        ? `Installed ${formatItemId(item, context.theme)}.`
        : `${formatItemId(item, context.theme)} is already installed.`,
    );
  }
}

module.exports = {
  runAdd,
};

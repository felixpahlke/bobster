"use strict";

const path = require("node:path");
const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const {
  addPlannedDelete,
  addPlannedWrite,
  applyWritePlan,
  createWritePlan,
  formatPlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { resolveProjectPath } = require("../fs/safe-path");
const { readLockfile, removeLockItem, writeLockfile } = require("../lockfile/lockfile");
const { removeModeYaml } = require("../modes/custom-modes");
const { formatItemId } = require("../output");
const { confirm } = require("../prompt");
const { resolveInstalledItem } = require("../registry/resolve-item");

async function runRemove(context) {
  const { args, cwd, flags, io } = context;
  const name = args[0];
  if (!name) {
    throw new BobsterError("Usage: bobster remove <name>");
  }

  const config = loadConfig(cwd, flags);
  const lockfile = await readLockfile(cwd);
  const item = resolveInstalledItem(lockfile, name, { type: flags.type });
  const plan = createWritePlan();

  if (item.type === "mode") {
    const modesPath = resolveProjectPath(cwd, config.paths.modes);
    const current = await readFileIfExists(modesPath);
    const removed = removeModeYaml(current || "customModes: []\n", item.modeSlug || item.name);
    if (removed.changed) {
      await addPlannedWrite(plan, cwd, modesPath, removed.content, { allowOverwrite: true, item });
    }
  } else {
    for (const file of item.files || []) {
      await addPlannedDelete(plan, cwd, path.resolve(cwd, file), { item });
    }
  }

  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          item,
          plan: {
            deletes: plan.deletes.map((entry) => entry.displayPath),
            updates: plan.updates.map((entry) => entry.displayPath),
          },
        },
        null,
        2,
      ),
    );
  } else {
    io.out(`Remove ${formatItemId(item, context.theme)}?`);
    const planText = formatPlan(plan, { theme: context.theme });
    io.out(planText || "No file changes needed.");
  }

  if (flags.dryRun) {
    return;
  }

  if (!flags.yes) {
    const accepted = await confirm("Proceed?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Remove cancelled.");
    }
  }

  await applyWritePlan(plan, { forceConflicts: true });
  removeLockItem(lockfile, item);
  await writeLockfile(cwd, lockfile);

  if (!flags.json) {
    io.out(`Removed ${formatItemId(item, context.theme)}.`);
  }
}

module.exports = {
  runRemove,
};

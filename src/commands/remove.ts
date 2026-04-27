"use strict";

const path = require("node:path");
const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const {
  addPlannedDelete,
  addPlannedWrite,
  createWritePlan,
  formatPlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { resolveProjectPath } = require("../fs/safe-path");
const { readLockfile, removeLockItem, writeLockfile } = require("../lockfile/lockfile");
const { removeModeYaml } = require("../modes/custom-modes");
const { formatItemId } = require("../output");
const { runPlannedOperation } = require("./planned-operation");
const { resolveInstalledItemForCommand } = require("./resolve");

async function runRemove(context) {
  const { args, cwd, flags, io } = context;
  const name = args[0];
  if (!name) {
    throw new BobsterError("Usage: bobster remove <name>");
  }

  const config = loadConfig(cwd, flags, { env: context.env });
  const lockfile = await readLockfile(cwd);
  const item = await resolveInstalledItemForCommand(context, lockfile, name, {
    message: "Did you mean one of these? Select an item to remove",
  });
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

  await runPlannedOperation(context, {
    plan,
    json: {
      item,
      plan: {
        deletes: plan.deletes.map((entry) => entry.displayPath),
        updates: plan.updates.map((entry) => entry.displayPath),
      },
    },
    print() {
      io.out(`Remove ${formatItemId(item, context.theme)}?`);
      const planText = formatPlan(plan, { theme: context.theme });
      io.out(planText || "No file changes needed.");
    },
    confirmSteps: () => flags.yes
      ? []
      : [{ message: "Proceed?", cancelMessage: "Remove cancelled." }],
    async afterApply() {
      removeLockItem(lockfile, item);
      await writeLockfile(cwd, lockfile);
    },
    successMessage: () => `Removed ${formatItemId(item, context.theme)}.`,
  });
}

module.exports = {
  runRemove,
};

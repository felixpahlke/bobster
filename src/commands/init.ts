"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { defaultConfig, defaultPaths, resolveConfigPath } = require("../config/defaults");
const { resolveProjectPath } = require("../fs/safe-path");
const {
  addPlannedWrite,
  createWritePlan,
  formatPlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { runPlannedOperation } = require("./planned-operation");

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function inferTarget(cwd, flags) {
  if (flags.target) {
    return flags.target;
  }
  if (await pathExists(path.join(cwd, ".bob"))) {
    return ".bob";
  }
  if (await pathExists(path.join(cwd, ".agents"))) {
    return ".agents";
  }
  return ".bob";
}

async function runInit(context) {
  const { cwd, flags, io } = context;
  const target = await inferTarget(cwd, flags);
  const config = defaultConfig(target);
  config.registry = flags.registry || config.registry;
  config.paths = defaultPaths(target);

  const plan = createWritePlan();
  const configPath = resolveConfigPath(cwd);
  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  const existingConfig = await readFileIfExists(configPath);

  if (existingConfig !== null && existingConfig !== configContent && !flags.force) {
    plan.conflicts.push({
      content: configContent,
      current: existingConfig,
      displayPath: "bobster.json",
      path: configPath,
    });
  } else {
    await addPlannedWrite(plan, cwd, configPath, configContent, {
      allowOverwrite: flags.force,
    });
  }

  const modesPath = resolveProjectPath(cwd, config.paths.modes);
  const modesContent = await readFileIfExists(modesPath);
  if (modesContent === null) {
    await addPlannedWrite(plan, cwd, modesPath, "customModes: []\n", {
      allowOverwrite: false,
    });
  }

  const dirs = [
    resolveProjectPath(cwd, target),
    resolveProjectPath(cwd, config.paths.skills),
    resolveProjectPath(cwd, config.paths.rules),
  ];
  const preserved = [];
  for (const existingPath of [...dirs, modesPath]) {
    if (await pathExists(existingPath)) {
      preserved.push(path.relative(cwd, existingPath));
    }
  }

  await runPlannedOperation(context, {
    plan,
    json: {
      target,
      creates: plan.creates.map((item) => item.displayPath),
      updates: plan.updates.map((item) => item.displayPath),
      conflicts: plan.conflicts.map((item) => item.displayPath),
      directories: dirs.map((dir) => path.relative(cwd, dir)),
      preserved,
    },
    print() {
      const planText = formatPlan(plan, { theme: context.theme });
      if (planText) {
        io.out(planText);
      }
      io.out(`Directories to ensure:\n  ${dirs.map((dir) => path.relative(cwd, dir)).join("\n  ")}`);
      if (preserved.length) {
        io.out(`Existing paths preserved:\n  ${preserved.join("\n  ")}`);
      }
    },
    confirmSteps: () => [
      {
        when: plan.conflicts.length && !flags.force,
        message: "Overwrite conflicting initialization files?",
        cancelMessage: "Initialization cancelled.",
      },
      {
        when: !flags.yes && !flags.force,
        message: "Initialize Bobster project?",
        cancelMessage: "Initialization cancelled.",
      },
    ],
    async beforeApply() {
      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
      }
    },
    successMessage: "Bobster initialized.",
  });
}

module.exports = {
  runInit,
};

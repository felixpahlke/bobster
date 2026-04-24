"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { defaultConfig, defaultPaths, resolveConfigPath } = require("../config/defaults");
const { BobsterError } = require("../error");
const { resolveProjectPath } = require("../fs/safe-path");
const {
  addPlannedWrite,
  applyWritePlan,
  createWritePlan,
  formatPlan,
  readFileIfExists,
} = require("../fs/write-plan");
const { confirm } = require("../prompt");

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

  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          target,
          creates: plan.creates.map((item) => item.displayPath),
          updates: plan.updates.map((item) => item.displayPath),
          conflicts: plan.conflicts.map((item) => item.displayPath),
          directories: dirs.map((dir) => path.relative(cwd, dir)),
          preserved,
        },
        null,
        2,
      ),
    );
  } else {
    const planText = formatPlan(plan, { theme: context.theme });
    if (planText) {
      io.out(planText);
    }
    io.out(`Directories to ensure:\n  ${dirs.map((dir) => path.relative(cwd, dir)).join("\n  ")}`);
    if (preserved.length) {
      io.out(`Existing paths preserved:\n  ${preserved.join("\n  ")}`);
    }
  }

  if (flags.dryRun) {
    return;
  }

  if (plan.conflicts.length && !flags.force) {
    const accepted = await confirm("Overwrite conflicting initialization files?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Initialization cancelled.");
    }
  }

  if (!flags.yes && !flags.force) {
    const accepted = await confirm("Initialize Bobster project?", {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Initialization cancelled.");
    }
  }

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  await applyWritePlan(plan, { forceConflicts: true });

  if (!flags.json) {
    io.out("Bobster initialized.");
  }
}

module.exports = {
  runInit,
};

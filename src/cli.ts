#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseArgv } = require("./args");
const { PACKAGE_ROOT } = require("./constants");
const { BobsterError } = require("./error");
const { commandHelpText, helpText } = require("./help");
const { createTheme } = require("./theme");
const { checkForUpdate } = require("./update-check");
const { runAdd } = require("./commands/add");
const { runInfo } = require("./commands/info");
const { runInit } = require("./commands/init");
const { runList } = require("./commands/list");
const { runRegistry } = require("./commands/registry");
const { runRemove } = require("./commands/remove");
const { runSearch } = require("./commands/search");
const { runUpdate } = require("./commands/update");

function createDefaultIo() {
  return {
    color: Boolean(process.stdout.isTTY && !process.env.NO_COLOR),
    stdin: process.stdin,
    stderr: process.stderr,
    out(message = "") {
      process.stdout.write(`${message}\n`);
    },
    err(message = "") {
      process.stderr.write(`${message}\n`);
    },
  };
}

function packageVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
  );
  return packageJson.version;
}

function shouldCheckForUpdates(parsed, io, options) {
  if (options.updateCheck === false || process.env.BOBSTER_NO_UPDATE_CHECK || process.env.CI) {
    return false;
  }
  if (parsed.flags.json || parsed.flags.version || parsed.flags.help || parsed.command === "help") {
    return false;
  }
  if (!options.updateCheck?.force && fs.existsSync(path.join(PACKAGE_ROOT, ".git"))) {
    return false;
  }
  return Boolean(io.stderr && io.stderr.isTTY);
}

async function maybeSuggestUpdate(parsed, io, theme, options) {
  if (!shouldCheckForUpdates(parsed, io, options)) {
    return;
  }

  let update;
  try {
    update = await checkForUpdate({
      ...options.updateCheck,
      currentVersion: packageVersion(),
    });
  } catch (error) {
    return;
  }
  if (!update) {
    return;
  }

  io.err(theme.warn(`Update available: bobster ${update.currentVersion} -> ${update.latestVersion}`));
  io.err(`Run ${theme.id("npm install -g bobster@latest")} to update, or use ${theme.id("npx bobster@latest <command>")}.`);
}

async function main(argv: string[], options: any = {}) {
  const io = options.io || createDefaultIo();
  const cwd = options.cwd || process.cwd();
  const parsed = parseArgv(argv);
  const colorEnabled = !parsed.flags.json && (
    options.color !== undefined ? options.color : Boolean(io.color)
  );
  const theme = createTheme(colorEnabled);
  const context = {
    args: parsed.args,
    command: parsed.command,
    cwd,
    flags: parsed.flags,
    io,
    theme,
  };

  if (parsed.flags.version) {
    io.out(packageVersion());
    return 0;
  }

  if (parsed.command === "help") {
    io.out(commandHelpText(parsed.command, parsed.args, theme) || helpText(theme));
    return 0;
  }

  if (parsed.flags.help) {
    io.out(commandHelpText(parsed.command, parsed.args, theme) || helpText(theme));
    return 0;
  }

  switch (parsed.command) {
    case "init":
      await runInit(context);
      break;
    case "list":
      await runList(context);
      break;
    case "search":
      await runSearch(context);
      break;
    case "info":
      await runInfo(context);
      break;
    case "add":
      await runAdd(context);
      break;
    case "learn":
      await runAdd(context, { commandName: "learn", forceType: "skill" });
      break;
    case "remove":
      await runRemove(context);
      break;
    case "forget":
      await runRemove(context);
      break;
    case "update":
      await runUpdate(context);
      break;
    case "registry":
      await runRegistry(context);
      break;
    case "registry:build":
      await runRegistry({ ...context, args: ["build", ...context.args] });
      break;
    case "registry:validate":
      await runRegistry({ ...context, args: ["validate", ...context.args] });
      break;
    default:
      throw new BobsterError(`Unknown command: ${parsed.command}\n\n${helpText(theme)}`);
  }

  await maybeSuggestUpdate(parsed, io, theme, options);

  return 0;
}

function run(argv: string[], options: any = {}) {
  main(argv, options).catch((error: any) => {
    const io = options.io || createDefaultIo();
    if (error instanceof BobsterError) {
      io.err(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    io.err(error.stack || error.message);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = {
  main,
  run,
};

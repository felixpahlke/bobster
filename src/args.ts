"use strict";

const { BobsterError } = require("./error");

const VALUE_FLAGS = new Set(["--target", "--registry", "--type", "--base-url"]);

function toFlagName(flag) {
  return flag
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseArgv(argv: string[]) {
  const flags: any = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (token === "-h") {
      flags.help = true;
      continue;
    }

    if (token === "-v") {
      flags.version = true;
      continue;
    }

    if (token === "-y") {
      flags.yes = true;
      continue;
    }

    if (token.startsWith("--")) {
      const [rawName, inlineValue] = token.split(/=(.*)/s, 2);

      if (VALUE_FLAGS.has(rawName)) {
        const value = inlineValue !== undefined ? inlineValue : argv[i + 1];
        if (!value || value.startsWith("--")) {
          throw new BobsterError(`${rawName} requires a value.`);
        }
        flags[toFlagName(rawName)] = value;
        if (inlineValue === undefined) {
          i += 1;
        }
        continue;
      }

      switch (rawName) {
        case "--yes":
          flags.yes = true;
          break;
        case "--dry-run":
          flags.dryRun = true;
          break;
        case "--force":
          flags.force = true;
          break;
        case "--json":
          flags.json = true;
          break;
        case "--installed":
          flags.installed = true;
          break;
        case "--check":
          flags.check = true;
          break;
        case "--help":
          flags.help = true;
          break;
        case "--version":
          flags.version = true;
          break;
        default:
          throw new BobsterError(`Unknown option: ${rawName}`);
      }
      continue;
    }

    positionals.push(token);
  }

  return {
    args: positionals.slice(1),
    command: positionals[0] || "help",
    flags,
  };
}

module.exports = {
  parseArgv,
};

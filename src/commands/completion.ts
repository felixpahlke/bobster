"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ITEM_TYPES, PACKAGE_ROOT } = require("../constants");
const { loadConfig } = require("../config/load-config");
const { BobsterError } = require("../error");
const { readLockfile } = require("../lockfile/lockfile");
const { confirm } = require("../prompt");
const { fetchRegistryIndex } = require("../registry/fetch-index");
const { normalizeType } = require("../registry/schemas");

const COMMANDS = [
  "init",
  "list",
  "search",
  "info",
  "add",
  "learn",
  "remove",
  "forget",
  "update",
  "completion",
  "registry",
  "registry:build",
  "registry:validate",
  "help",
];

const SUPPORTED_SHELLS = ["zsh", "bash", "fish"];
const COMPLETION_SUBCOMMANDS = ["install", ...SUPPORTED_SHELLS];
const REGISTRY_SUBCOMMANDS = ["build", "validate"];
const GLOBAL_FLAGS = ["--help", "--version"];
const VALUE_FLAGS = new Set(["--target", "--registry", "--type", "--base-url"]);
const MANAGED_START = "# >>> bobster completion >>>";
const MANAGED_END = "# <<< bobster completion <<<";

const COMMAND_FLAGS = {
  init: ["--target", "--registry", "--yes", "--force", "--dry-run", "--json", "--help"],
  list: ["--type", "--installed", "--registry", "--json", "--help"],
  search: ["--type", "--registry", "--json", "--help"],
  info: ["--type", "--registry", "--json", "--help"],
  add: ["--type", "--dry-run", "--yes", "--force", "--json", "--help"],
  learn: ["--dry-run", "--yes", "--force", "--json", "--help"],
  remove: ["--type", "--dry-run", "--yes", "--json", "--help"],
  forget: ["--dry-run", "--yes", "--json", "--help"],
  update: ["--type", "--dry-run", "--yes", "--json", "--help"],
  completion: ["--dry-run", "--yes", "--json", "--help"],
  registry: ["--base-url", "--check", "--json", "--help"],
  "registry:build": ["--base-url", "--check", "--json", "--help"],
  "registry:validate": ["--json", "--help"],
  help: [],
};

function supportedShell(shell) {
  return SUPPORTED_SHELLS.includes(shell);
}

function assertSupportedShell(shell) {
  if (!supportedShell(shell)) {
    throw new BobsterError(`Unsupported shell: ${shell}. Expected one of: ${SUPPORTED_SHELLS.join(", ")}.`);
  }
}

function completionFileName(shell) {
  return {
    bash: "bobster.bash",
    fish: "bobster.fish",
    zsh: "_bobster",
  }[shell];
}

async function completionScript(shell) {
  assertSupportedShell(shell);
  return fs.readFile(path.join(PACKAGE_ROOT, "completions", completionFileName(shell)), "utf8");
}

function homeDir() {
  return process.env.HOME || os.homedir();
}

function displayPath(filePath) {
  const home = homeDir();
  return filePath === home || filePath.startsWith(`${home}${path.sep}`)
    ? `~${filePath.slice(home.length)}`
    : filePath;
}

function detectShell() {
  const shell = path.basename(process.env.SHELL || "");
  return supportedShell(shell) ? shell : null;
}

function shellConfigPath(shell) {
  const home = homeDir();
  if (shell === "zsh") {
    return path.join(process.env.ZDOTDIR || home, ".zshrc");
  }
  if (shell === "bash") {
    return path.join(home, ".bashrc");
  }
  return null;
}

function shellCompletionPath(shell) {
  const home = homeDir();
  if (shell === "zsh") {
    return path.join(home, ".zfunc", "_bobster");
  }
  if (shell === "bash") {
    return path.join(home, ".bobster-completion.bash");
  }
  return path.join(home, ".config", "fish", "completions", "bobster.fish");
}

function managedBlock(shell) {
  if (shell === "zsh") {
    return [
      MANAGED_START,
      'fpath=("$HOME/.zfunc" $fpath)',
      "autoload -Uz compinit",
      "compinit",
      MANAGED_END,
      "",
    ].join("\n");
  }

  if (shell === "bash") {
    return [
      MANAGED_START,
      'if [ -f "$HOME/.bobster-completion.bash" ]; then',
      '  . "$HOME/.bobster-completion.bash"',
      "fi",
      MANAGED_END,
      "",
    ].join("\n");
  }

  return null;
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function upsertManagedBlock(content, block) {
  const start = content.indexOf(MANAGED_START);
  const end = content.indexOf(MANAGED_END);
  if (start !== -1 && end !== -1 && end > start) {
    return `${content.slice(0, start)}${block}${content.slice(end + MANAGED_END.length).replace(/^\n/, "")}`;
  }

  const prefix = content && !content.endsWith("\n") ? `${content}\n\n` : content ? `${content}\n` : "";
  return `${prefix}${block}`;
}

async function completionInstallPlan(shell) {
  assertSupportedShell(shell);
  return {
    configBlock: managedBlock(shell),
    configPath: shellConfigPath(shell),
    script: await completionScript(shell),
    scriptPath: shellCompletionPath(shell),
    shell,
  };
}

function formatCompletionInstallPlan(plan) {
  const lines = [
    "Completion install plan:",
    `  shell: ${plan.shell}`,
    `  write: ${displayPath(plan.scriptPath)}`,
  ];
  if (plan.configPath && plan.configBlock) {
    lines.push(`  update: ${displayPath(plan.configPath)}`);
  }
  return lines.join("\n");
}

async function installCompletion(context) {
  const shell = context.args[1] || detectShell();
  if (!shell) {
    throw new BobsterError(`Could not detect shell. Run bobster completion install <${SUPPORTED_SHELLS.join("|")}>.`);
  }

  const plan = await completionInstallPlan(shell);
  if (context.flags.json) {
    context.io.out(
      JSON.stringify(
        {
          configPath: plan.configPath,
          scriptPath: plan.scriptPath,
          shell: plan.shell,
        },
        null,
        2,
      ),
    );
  } else {
    context.io.out(formatCompletionInstallPlan(plan));
  }

  if (context.flags.dryRun) {
    return;
  }

  if (!context.flags.yes) {
    const accepted = await confirm(`Install ${shell} completion?`, {
      input: context.io.stdin,
      output: context.io.stderr,
    });
    if (!accepted) {
      throw new BobsterError("Completion installation cancelled.");
    }
  }

  await fs.mkdir(path.dirname(plan.scriptPath), { recursive: true });
  await fs.writeFile(plan.scriptPath, plan.script, "utf8");

  if (plan.configPath && plan.configBlock) {
    const currentConfig = await readIfExists(plan.configPath);
    const nextConfig = upsertManagedBlock(currentConfig, plan.configBlock);
    if (nextConfig !== currentConfig) {
      await fs.mkdir(path.dirname(plan.configPath), { recursive: true });
      await fs.writeFile(plan.configPath, nextConfig, "utf8");
    }
  }

  if (!context.flags.json) {
    context.io.out(`Installed ${shell} completion.`);
    context.io.out("Restart your shell or open a new terminal for changes to take effect.");
  }
}

function toFlagName(flag) {
  return flag
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function unique(values: string[]) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function byCurrent(values, current) {
  return unique(values).filter((value) => value.startsWith(current));
}

function normalizeCompletionWords(rawWords, options: any = {}) {
  const words = rawWords[0] === "--" ? rawWords.slice(1) : [...rawWords];
  const rawIndex = options.completeIndex ?? process.env.BOBSTER_COMPLETE_INDEX;
  const parsedIndex = Number(rawIndex);
  const index = Number.isInteger(parsedIndex) && parsedIndex >= 0
    ? parsedIndex
    : Math.max(0, words.length - 1);

  while (words.length <= index) {
    words.push("");
  }

  return {
    current: words[index] || "",
    index,
    previous: index > 0 ? words[index - 1] : "",
    words,
  };
}

function parseWords(words, currentIndex) {
  const flags: any = {};
  const positionals = [];

  for (let i = 0; i < words.length; i += 1) {
    if (i === currentIndex) {
      continue;
    }

    const token = words[i];
    if (!token) {
      continue;
    }

    if (token === "--") {
      for (let j = i + 1; j < words.length; j += 1) {
        if (j !== currentIndex && words[j]) {
          positionals.push(words[j]);
        }
      }
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
        if (inlineValue !== undefined) {
          flags[toFlagName(rawName)] = inlineValue;
        } else if (i + 1 < words.length && i + 1 !== currentIndex) {
          flags[toFlagName(rawName)] = words[i + 1];
          i += 1;
        }
        continue;
      }

      flags[toFlagName(rawName)] = true;
      continue;
    }

    positionals.push(token);
  }

  return {
    args: positionals.slice(1),
    command: positionals[0] || null,
    flags,
  };
}

function completeValueFlag(previous, current) {
  if (current.startsWith("--type=")) {
    const prefix = current.slice("--type=".length);
    return byCurrent(ITEM_TYPES.map((type) => `--type=${type}`), `--type=${prefix}`);
  }

  if (previous === "--type") {
    return byCurrent(ITEM_TYPES, current);
  }

  return null;
}

function commandFlags(command, current) {
  const flags = command ? COMMAND_FLAGS[command] || [] : GLOBAL_FLAGS;
  return byCurrent([...GLOBAL_FLAGS, ...flags], current);
}

function parsedType(flags) {
  if (!flags.type) {
    return null;
  }

  try {
    return normalizeType(flags.type);
  } catch {
    return null;
  }
}

function itemSuggestions(items, options: any = {}) {
  const current = options.current || "";
  let type = options.type || null;
  const explicitType = parsedTypePrefix(current);

  if (explicitType) {
    type = explicitType;
  }

  const matchingItems = items.filter((item) => {
    return (!type || item.type === type) && (!options.allowedTypes || options.allowedTypes.includes(item.type));
  });

  if (explicitType) {
    return byCurrent(matchingItems.map((item) => `${item.type}/${item.name}`), current);
  }

  const values = matchingItems.flatMap((item) => {
    if (options.unqualified || type) {
      return [item.name];
    }
    return [`${item.type}/${item.name}`];
  });

  return byCurrent(values, current);
}

function parsedTypePrefix(current) {
  const slash = current.indexOf("/");
  if (slash === -1) {
    return null;
  }

  try {
    return normalizeType(current.slice(0, slash));
  } catch {
    return null;
  }
}

async function registryItems(cwd, flags) {
  const config = loadConfig(cwd, flags);
  const registryContext = await fetchRegistryIndex(config.registry, { cwd });
  return registryContext.index.items;
}

async function installedItems(cwd) {
  const lockfile = await readLockfile(cwd);
  return lockfile.items || [];
}

async function completeName(command, cwd, parsed, current) {
  const type = parsedType(parsed.flags);

  if (command === "add" || command === "info") {
    const items = await registryItems(cwd, parsed.flags);
    return itemSuggestions(items, {
      allowedTypes: ITEM_TYPES,
      current,
      type,
      unqualified: true,
    });
  }

  if (command === "learn") {
    const items = await registryItems(cwd, { ...parsed.flags, type: "skill" });
    return itemSuggestions(items, {
      allowedTypes: ["skill"],
      current,
      type: "skill",
      unqualified: true,
    });
  }

  if (command === "remove" || command === "forget" || command === "update") {
    const items = await installedItems(cwd);
    return itemSuggestions(items, {
      allowedTypes: ITEM_TYPES,
      current,
      type,
      unqualified: Boolean(type),
    });
  }

  return [];
}

async function completionSuggestions(rawWords, options: any = {}) {
  const { current, index, previous, words } = normalizeCompletionWords(rawWords, options);
  const valueFlag = completeValueFlag(previous, current);
  if (valueFlag) {
    return valueFlag;
  }

  const parsed = parseWords(words, index);

  if (!parsed.command) {
    if (current.startsWith("--")) {
      return commandFlags(null, current);
    }
    return byCurrent(COMMANDS, current);
  }

  if (parsed.command === "help") {
    return byCurrent(COMMANDS.filter((command) => command !== "help"), current);
  }

  if (parsed.command === "completion") {
    if (parsed.args.length === 0) {
      return byCurrent(COMPLETION_SUBCOMMANDS, current);
    }
    if (parsed.args[0] === "install" && parsed.args.length === 1) {
      return byCurrent(SUPPORTED_SHELLS, current);
    }
    return [];
  }

  if (current.startsWith("--")) {
    return commandFlags(parsed.command, current);
  }

  if (parsed.command === "registry" && parsed.args.length === 0) {
    return byCurrent(REGISTRY_SUBCOMMANDS, current);
  }

  const effectiveCommand = parsed.command === "registry" && parsed.args[0]
    ? `registry:${parsed.args[0]}`
    : parsed.command;

  if (parsed.args.length === 0 || (parsed.command === "registry" && parsed.args.length === 1)) {
    return completeName(effectiveCommand, options.cwd || process.cwd(), parsed, current);
  }

  return [];
}

async function runComplete(rawWords, options: any = {}) {
  const suggestions = await completionSuggestions(rawWords, options);
  options.io.out(suggestions.join("\n"));
}

async function runCompletion(context) {
  const subcommand = context.args[0];

  if (subcommand === "install") {
    await installCompletion(context);
    return;
  }

  if (supportedShell(subcommand)) {
    context.io.out((await completionScript(subcommand)).trimEnd());
    return;
  }

  throw new BobsterError(`Usage: bobster completion <${SUPPORTED_SHELLS.join("|")}> or bobster completion install [${SUPPORTED_SHELLS.join("|")}].`);
}

module.exports = {
  completionSuggestions,
  runComplete,
  runCompletion,
};

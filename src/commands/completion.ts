"use strict";

const { ITEM_TYPES } = require("../constants");
const { BobsterError } = require("../error");
const { loadConfig } = require("../config/load-config");
const { readLockfile } = require("../lockfile/lockfile");
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
  "registry",
  "registry:build",
  "registry:validate",
  "completion",
  "help",
];

const REGISTRY_SUBCOMMANDS = ["build", "validate"];
const SHELLS = ["bash", "zsh", "fish"];
const GLOBAL_FLAGS = ["--help", "--version"];
const VALUE_FLAGS = new Set(["--target", "--registry", "--type", "--base-url"]);

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
  registry: ["--base-url", "--check", "--json", "--help"],
  "registry:build": ["--base-url", "--check", "--json", "--help"],
  "registry:validate": ["--json", "--help"],
  completion: ["--help"],
  help: [],
};

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

  const values = matchingItems.flatMap((item) => {
    if (options.unqualified || type) {
      return [item.name];
    }
    return [`${item.type}/${item.name}`];
  });

  if (explicitType && !options.unqualified) {
    return byCurrent(matchingItems.map((item) => `${item.type}/${item.name}`), current);
  }

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
      unqualified: Boolean(type),
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
    return byCurrent(SHELLS, current);
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

function completionScript(shell) {
  switch (shell) {
    case "bash":
      return `# bash completion for bobster
_bobster_completion() {
  local suggestions
  local current_index=$((COMP_CWORD - 1))
  suggestions=$(BOBSTER_COMPLETE_INDEX="$current_index" bobster __complete -- "\${COMP_WORDS[@]:1}" 2>/dev/null) || return 0
  [[ -z "$suggestions" ]] && return 0
  local IFS=$'\\n'
  COMPREPLY=($(compgen -W "$suggestions" -- "\${COMP_WORDS[COMP_CWORD]}"))
}

complete -o default -F _bobster_completion bobster
`;
    case "zsh":
      return `#compdef bobster

_bobster_completion() {
  local current_index=$((CURRENT - 2))
  (( current_index < 0 )) && current_index=0
  local -a suggestions
  suggestions=("\${(@f)$(BOBSTER_COMPLETE_INDEX="$current_index" bobster __complete -- "\${words[@]:1}" 2>/dev/null)}")
  if (( \${#suggestions[@]} )); then
    compadd -- "\${suggestions[@]}"
  else
    _files
  fi
}

_bobster_completion "$@"
`;
    case "fish":
      return `function __bobster_complete
    set -l tokens (commandline -opc)
    if test (count $tokens) -gt 0
        set -e tokens[1]
    end

    set -l current_index (math (count $tokens) - 1)
    set -l current_token (commandline -ct)
    if test -z "$current_token"
        set current_index (count $tokens)
        set -a tokens ""
    end

    env BOBSTER_COMPLETE_INDEX=$current_index bobster __complete -- $tokens 2>/dev/null
end

complete -c bobster -f -a "(__bobster_complete)"
`;
    default:
      throw new BobsterError(`Unknown shell: ${shell}`);
  }
}

function completionUsage() {
  return "Usage: bobster completion <bash|zsh|fish>";
}

async function runCompletion(context) {
  const shell = context.args[0];
  if (!shell || context.flags.help) {
    context.io.out(completionUsage());
    return;
  }

  if (!SHELLS.includes(shell)) {
    throw new BobsterError(`${completionUsage()}\n\nUnknown shell: ${shell}`);
  }

  context.io.out(completionScript(shell).trimEnd());
}

async function runComplete(rawWords, options: any = {}) {
  const suggestions = await completionSuggestions(rawWords, options);
  options.io.out(suggestions.join("\n"));
}

module.exports = {
  completionScript,
  completionSuggestions,
  runComplete,
  runCompletion,
};

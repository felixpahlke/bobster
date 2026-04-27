"use strict";

const { ITEM_TYPES } = require("../constants");

const SUPPORTED_SHELLS = ["zsh", "bash", "fish"];
const COMPLETION_SUBCOMMANDS = ["install", ...SUPPORTED_SHELLS];
const REGISTRY_SUBCOMMANDS = ["add", "list", "remove", "doctor", "build", "validate"];
const GLOBAL_FLAGS = ["--help", "--version"];
const VALUE_FLAGS = new Set(["--target", "--registry", "--type", "--base-url", "--file"]);

const COMMAND_HELP = {
  init: {
    usage: "bobster init [options]",
    description: "Create bobster.json and the target Bob asset folders.",
    options: [
      "--target <path>      Target folder to initialize. Defaults to .bob.",
      "--registry <url>     Registry index URL or local index path.",
      "--yes               Apply without confirmation.",
      "--force             Overwrite conflicting bobster.json content.",
      "--dry-run           Show planned writes without changing files.",
      "--json              Print the plan as JSON.",
    ],
  },
  list: {
    usage: "bobster list [options]",
    description: "List registry items or installed lockfile items.",
    options: [
      "--type <type>        Filter to skill, rule, or mode.",
      "--installed          List installed items from bobster-lock.json.",
      "--registry <url>     Registry index URL or local index path.",
      "--json              Print JSON.",
    ],
  },
  search: {
    usage: "bobster search <query> [options]",
    description: "Search names, descriptions, tags, and item types.",
    options: [
      "--type <type>        Filter to skill, rule, or mode.",
      "--registry <url>     Registry index URL or local index path.",
      "--json              Print JSON.",
    ],
  },
  info: {
    usage: "bobster info <name> [options]",
    description: "Show registry metadata, files, source, and install target.",
    options: [
      "--type <type>        Resolve an unqualified name as skill, rule, or mode.",
      "--registry <url>     Registry index URL or local index path.",
      "--json              Print JSON.",
    ],
  },
  show: {
    usage: "bobster show <name> [options]",
    description: "Print the registry item contents.",
    options: [
      "--type <type>        Resolve an unqualified name as skill, rule, or mode.",
      "--file <path>        Print one manifest-listed file.",
      "--all               Print every file listed by the item manifest.",
      "--registry <url>     Registry index URL or local index path.",
      "--json              Print JSON.",
    ],
  },
  add: {
    usage: "bobster add <name> [options]",
    description: "Install one registry item into the configured Bob asset paths.",
    options: [
      "--type <type>        Resolve an unqualified name as skill, rule, or mode.",
      "--dry-run           Show planned writes without changing files.",
      "--yes               Apply without confirmation unless conflicts are present.",
      "--force             Overwrite conflicting files.",
      "--json              Print the plan as JSON.",
    ],
  },
  learn: {
    usage: "bobster learn <skill-name> [options]",
    description: "Alias for bobster add skill/<skill-name>.",
    options: [
      "--dry-run           Show planned writes without changing files.",
      "--yes               Apply without confirmation unless conflicts are present.",
      "--force             Overwrite conflicting files.",
      "--json              Print the plan as JSON.",
    ],
  },
  remove: {
    usage: "bobster remove <name> [options]",
    description: "Remove files tracked for an installed lockfile item.",
    options: [
      "--type <type>        Resolve an unqualified name as skill, rule, or mode.",
      "--dry-run           Show planned deletes without changing files.",
      "--yes               Apply without confirmation.",
      "--json              Print the plan as JSON.",
    ],
  },
  forget: {
    usage: "bobster forget <name> [options]",
    description: "Alias for bobster remove <name>.",
    options: [
      "--dry-run           Show planned deletes without changing files.",
      "--yes               Apply without confirmation.",
      "--json              Print the plan as JSON.",
    ],
  },
  update: {
    usage: "bobster update [name] [options]",
    description: "Reinstall installed items from the configured registry.",
    options: [
      "--dry-run           Show planned writes without changing files.",
      "--yes               Apply without confirmation.",
      "--json              Print the plan as JSON.",
    ],
  },
  completion: {
    usage: "bobster completion <zsh|bash|fish|install> [shell] [options]",
    description: "Print or install shell completion for the bobster command.",
    options: [
      "--dry-run           Show install paths without changing files.",
      "--yes               Install without prompting.",
      "--json              Print install paths as JSON.",
    ],
  },
  registry: {
    usage: "bobster registry <add|list|remove|doctor|build|validate> [options]",
    description: "Manage configured registries or build the committed registry/index.json file.",
    options: [
      "add <name> <url>    Add a registry index URL or local index path.",
      "list                List configured registries.",
      "remove <name>       Remove a configured registry.",
      "doctor [name]       Validate configured registry access and schema.",
      "--base-url <url>     Base URL to store in generated index.json.",
      "--check             Compare generated content with the committed index.",
      "--force             Replace an existing registry with registry add.",
      "--json              Print JSON.",
    ],
  },
};

const COMMANDS = [
  "init",
  "list",
  "search",
  "info",
  "show",
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

const COMMAND_FLAGS = {
  init: ["--target", "--registry", "--yes", "--force", "--dry-run", "--json", "--help"],
  list: ["--type", "--installed", "--registry", "--json", "--help"],
  search: ["--type", "--registry", "--json", "--help"],
  info: ["--type", "--registry", "--json", "--help"],
  show: ["--type", "--file", "--all", "--registry", "--json", "--help"],
  add: ["--type", "--dry-run", "--yes", "--force", "--json", "--help"],
  learn: ["--dry-run", "--yes", "--force", "--json", "--help"],
  remove: ["--type", "--dry-run", "--yes", "--json", "--help"],
  forget: ["--dry-run", "--yes", "--json", "--help"],
  update: ["--type", "--dry-run", "--yes", "--json", "--help"],
  completion: ["--dry-run", "--yes", "--json", "--help"],
  registry: ["--base-url", "--check", "--force", "--json", "--help"],
  "registry:build": ["--base-url", "--check", "--json", "--help"],
  "registry:validate": ["--json", "--help"],
  help: [],
};

const COMMAND_OVERVIEW_GROUPS = [
  {
    heading: "CORE COMMANDS",
    commands: [
      ["search", "Search the registry"],
      ["info", "Show item metadata and install targets"],
      ["show", "Print item file contents"],
      ["add", "Install a skill, rule, or mode"],
      ["remove", "Remove an installed item"],
      ["update", "Reinstall installed items from the registry"],
      ["list", "List registry or installed items"],
    ],
  },
  {
    heading: "SETUP COMMANDS",
    commands: [
      ["completion", "Install or print shell completions"],
      ["init", "Write bobster.json for custom paths or registries"],
    ],
  },
  {
    heading: "ALIASES",
    commands: [
      ["learn", "Install a skill"],
      ["forget", "Remove an installed item"],
    ],
  },
  {
    heading: "REGISTRY COMMANDS",
    commands: [
      ["registry add", "Add a public or private registry"],
      ["registry list", "List configured registries"],
      ["registry doctor", "Check registry access and schema"],
      ["registry build", "Rebuild registry/index.json"],
      ["registry validate", "Validate registry manifests and files"],
    ],
  },
];

module.exports = {
  COMMAND_FLAGS,
  COMMAND_HELP,
  COMMAND_OVERVIEW_GROUPS,
  COMMANDS,
  COMPLETION_SUBCOMMANDS,
  GLOBAL_FLAGS,
  ITEM_TYPES,
  REGISTRY_SUBCOMMANDS,
  SUPPORTED_SHELLS,
  VALUE_FLAGS,
};

"use strict";

function identity(value) {
  return value;
}

function helpers(theme) {
  return {
    command: theme ? theme.id : identity,
    heading: theme ? theme.heading : identity,
    value: theme ? theme.value : identity,
  };
}

function commandLine(command, theme) {
  const h = helpers(theme);
  return `  ${h.command(command)}`;
}

function helpText(theme) {
  const h = helpers(theme);
  return `${h.heading("Bobster")}

Usage:
${commandLine("bobster init [--target .bob] [--registry <url>] [--yes] [--force]", theme)}
${commandLine("bobster list [--type skill|rule|mode] [--installed] [--json]", theme)}
${commandLine("bobster search <query> [--type skill|rule|mode] [--json]", theme)}
${commandLine("bobster info <name> [--type skill|rule|mode] [--json]", theme)}
${commandLine("bobster add <name> [--dry-run] [--yes] [--force] [--json]", theme)}
${commandLine("bobster remove <name> [--dry-run] [--yes] [--json]", theme)}
${commandLine("bobster update [name] [--dry-run] [--yes] [--json]", theme)}
${commandLine("bobster completion <zsh|bash|fish|install>", theme)}

Aliases:
${commandLine("bobster learn <skill-name>", theme)}
${commandLine("bobster forget <name>", theme)}

Registry maintenance:
${commandLine("bobster registry build [--base-url <url>]", theme)}
${commandLine("bobster registry validate", theme)}

Names can be type-qualified, for example:
  ${h.value("skill/frontend-design")}
  ${h.value("rule/no-secrets")}
  ${h.value("mode/grug-brained")}

Run ${h.command("bobster <command> --help")} for command-specific help.`;
}

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
    usage: "bobster registry <build|validate> [options]",
    description: "Build or validate the committed registry/index.json file.",
    options: [
      "--base-url <url>     Base URL to store in generated index.json.",
      "--check             Compare generated content with the committed index.",
      "--json              Print the generated index JSON.",
    ],
  },
};

function commandHelpText(command, args = [], theme) {
  const name = command === "help" ? args[0] : command;
  const entry = COMMAND_HELP[name] || (name === "registry:build" || name === "registry:validate" ? COMMAND_HELP.registry : null);
  if (!entry) {
    return null;
  }

  const h = helpers(theme);
  return `${h.heading(name)}

${entry.description}

Usage:
${commandLine(entry.usage, theme)}

Options:
${entry.options.map((option) => `  ${option}`).join("\n")}`;
}

module.exports = {
  commandHelpText,
  helpText,
};

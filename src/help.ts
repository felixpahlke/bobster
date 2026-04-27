"use strict";

const { COMMAND_HELP, COMMAND_OVERVIEW_GROUPS } = require("./commands/metadata");

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

function overviewLine(command, description, theme) {
  const h = helpers(theme);
  return `  ${h.command(`${command}:`.padEnd(20))}${description}`;
}

function helpText(theme) {
  const h = helpers(theme);
  const groups = COMMAND_OVERVIEW_GROUPS
    .map((group) => [
      group.heading,
      ...group.commands.map(([command, description]) => overviewLine(command, description, theme)),
    ].join("\n"))
    .join("\n\n");

  return `${h.heading("Bobster")}

Manage reusable Bob skills, rules, and modes.

USAGE
  ${h.command("bobster <command> [flags]")}

${groups}

Run ${h.command("bobster <command> --help")} for command-specific flags.`;
}

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

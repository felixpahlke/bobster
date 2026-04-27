"use strict";

const readline = require("node:readline/promises");
const { AutoComplete, Select } = require("enquirer");
const { TYPE_LABELS } = require("./constants");
const { BobsterError } = require("./error");
const { itemId } = require("./output");

const SUGGESTION_TYPE_ORDER = ["mode", "rule", "skill"];
const PROMPT_DETAIL_SEPARATOR = "  ";

function sortedSelectableChoices(prompt) {
  return prompt.selectable
    .filter((choice) => typeof choice.index === "number")
    .sort((left, right) => left.index - right.index);
}

function isFirstSelectableChoice(prompt) {
  const selectable = sortedSelectableChoices(prompt);
  return selectable.length > 0 && prompt.focused?.index === selectable[0].index;
}

function isLastSelectableChoice(prompt) {
  const selectable = sortedSelectableChoices(prompt);
  return selectable.length > 0 && prompt.focused?.index === selectable[selectable.length - 1].index;
}

function clampPromptNavigation(Prompt) {
  return class NonWrappingPrompt extends Prompt {
    up() {
      if (isFirstSelectableChoice(this)) {
        return this.alert();
      }
      return super.up();
    }

    down() {
      if (isLastSelectableChoice(this)) {
        return this.alert();
      }
      return super.down();
    }
  };
}

function isReadlineClosedError(error) {
  return error?.code === "ERR_USE_AFTER_CLOSE" && /readline/i.test(error.message || "");
}

function isPromptAbortError(error) {
  return isReadlineClosedError(error) ||
    error?.name === "AbortError" ||
    error?.code === "ABORT_ERR";
}

function safeCloseReadline(rl) {
  try {
    rl.close();
  } catch (error) {
    if (!isReadlineClosedError(error)) {
      throw error;
    }
  }
}

function makePromptCleanupSafe(prompt) {
  const start = prompt.start.bind(prompt);
  prompt.start = function startWithSafeCleanup(...args) {
    const result = start(...args);
    const stop = this.stop;

    if (typeof stop === "function") {
      const safeStop = () => {
        try {
          stop();
        } catch (error) {
          if (!isReadlineClosedError(error)) {
            throw error;
          }
        }
      };
      this.removeListener("close", stop);
      this.stop = safeStop;
      this.once("close", safeStop);
    }

    return result;
  };
}

function canPrompt(context) {
  return Boolean(
    !context.flags?.json &&
      !process.env.CI &&
      process.env.BOBSTER_INTERACTIVE !== "0" &&
      context.io?.stdin?.isTTY &&
      context.io?.stderr?.isTTY,
  );
}

async function confirm(message: string, options: any = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stderr;

  if (!input.isTTY) {
    return false;
  }

  const suffix = options.defaultValue ? " [Y/n] " : " [y/N] ";
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message}${suffix}`);
    const normalized = answer.trim().toLowerCase();
    if (!normalized) {
      return Boolean(options.defaultValue);
    }
    return normalized === "y" || normalized === "yes";
  } catch (error) {
    if (isPromptAbortError(error)) {
      return false;
    }
    throw error;
  } finally {
    safeCloseReadline(rl);
  }
}

async function selectChoice(message: string, choices: any[], options: any = {}) {
  if (!choices.length) {
    return null;
  }

  const Prompt: any = clampPromptNavigation(options.searchable ? AutoComplete : Select);
  const suggest = options.suggest ? { suggest: options.suggest } : {};
  const prompt = new Prompt({
    choices,
    limit: options.limit || Math.min(10, choices.length),
    message,
    name: "selection",
    stdin: options.input || process.stdin,
    stdout: options.output || process.stderr,
    ...suggest,
  });
  makePromptCleanupSafe(prompt);

  try {
    return await prompt.run();
  } catch (error) {
    throw new BobsterError("Selection cancelled.");
  }
}

function itemChoice(item) {
  const id = itemId(item);
  return {
    description: item.description || "",
    idLabel: id,
    itemType: item.type,
    name: id,
    searchText: [
      id,
      item.version,
      item.status,
      item.description,
      ...(Array.isArray(item.topics) ? item.topics : []),
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ].filter(Boolean).join(" "),
    status: item.status,
  };
}

function promptColumns(choices: any[]) {
  const itemChoices = choices.filter((choice) => choice.idLabel);
  return {
    idWidth: Math.max(10, ...itemChoices.map((choice) => String(choice.idLabel).length)),
  };
}

function formatPromptChoice(choice, columns, theme) {
  if (!choice.idLabel) {
    return choice;
  }

  const id = String(choice.idLabel).padEnd(columns.idWidth);
  const details = [];

  if (choice.status === "deprecated") {
    details.push(theme ? theme.danger(choice.status) : choice.status);
  }
  if (choice.description) {
    details.push(theme ? theme.dim(choice.description) : choice.description);
  }

  return {
    ...choice,
    message: [theme ? theme.id(id) : id, ...details].join(PROMPT_DETAIL_SEPARATOR).trimEnd(),
  };
}

function formatPromptChoices(choices: any[], options: any = {}) {
  const columns = promptColumns(choices);
  return choices.map((choice) => formatPromptChoice(choice, columns, options.theme));
}

function groupChoicesByType(choices: any[], options: any = {}) {
  const grouped = [];
  const seen = new Set();

  for (const type of SUGGESTION_TYPE_ORDER) {
    const typeChoices = formatPromptChoices(
      choices.filter((choice) => choice.itemType === type),
      options,
    );
    if (!typeChoices.length) {
      continue;
    }

    seen.add(type);
    grouped.push({
      name: `__${type}_heading`,
      message: options.theme ? options.theme.heading(TYPE_LABELS[type]) : TYPE_LABELS[type],
      role: "heading",
    });
    grouped.push(...typeChoices);
  }

  grouped.push(...formatPromptChoices(choices.filter((choice) => !seen.has(choice.itemType)), options));
  return grouped;
}

function matchChoice(choice, input) {
  const query = String(input || "").trim().toLowerCase();
  return !query || String(choice.searchText || choice.message || "").toLowerCase().includes(query);
}

function suggestGroupedChoices(input, choices: any[], options: any = {}) {
  return groupChoicesByType(
    choices
      .filter((choice) => choice.role !== "heading")
      .filter((choice) => matchChoice(choice, input)),
    options,
  );
}

async function selectItem(message: string, items: any[], options: any = {}) {
  const itemChoices = items.map(itemChoice);
  const choices = options.groupByType
    ? groupChoicesByType(itemChoices, { theme: options.theme })
    : formatPromptChoices(itemChoices, { theme: options.theme });
  const selectedId = await selectChoice(message, choices, {
    ...options,
    suggest: options.groupByType
      ? (input, choices) => suggestGroupedChoices(input, choices, { theme: options.theme })
      : options.suggest,
  });
  if (!selectedId) {
    return null;
  }
  return items.find((item) => itemId(item) === selectedId) || null;
}

module.exports = {
  canPrompt,
  confirm,
  groupChoicesByType,
  selectChoice,
  selectItem,
  suggestGroupedChoices,
};

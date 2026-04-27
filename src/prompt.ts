"use strict";

const readline = require("node:readline/promises");
const { AutoComplete, Select } = require("enquirer");
const { TYPE_LABELS } = require("./constants");
const { BobsterError } = require("./error");
const { itemId } = require("./output");

const SUGGESTION_TYPE_ORDER = ["mode", "rule", "skill"];

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

  const Prompt = options.searchable ? AutoComplete : Select;
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
    itemType: item.type,
    name: id,
    message: `${id}  ${item.description || ""}`.trimEnd(),
  };
}

function groupChoicesByType(choices: any[]) {
  const grouped = [];
  const seen = new Set();

  for (const type of SUGGESTION_TYPE_ORDER) {
    const typeChoices = choices.filter((choice) => choice.itemType === type);
    if (!typeChoices.length) {
      continue;
    }

    seen.add(type);
    grouped.push({
      name: `__${type}_heading`,
      message: TYPE_LABELS[type],
      role: "heading",
    });
    grouped.push(...typeChoices);
  }

  grouped.push(...choices.filter((choice) => !seen.has(choice.itemType)));
  return grouped;
}

function matchChoice(choice, input) {
  const query = String(input || "").trim().toLowerCase();
  return !query || String(choice.message || "").toLowerCase().includes(query);
}

function suggestGroupedChoices(input, choices: any[]) {
  return groupChoicesByType(
    choices
      .filter((choice) => choice.role !== "heading")
      .filter((choice) => matchChoice(choice, input)),
  );
}

async function selectItem(message: string, items: any[], options: any = {}) {
  const itemChoices = items.map(itemChoice);
  const choices = options.groupByType ? groupChoicesByType(itemChoices) : itemChoices;
  const selectedId = await selectChoice(message, choices, {
    ...options,
    suggest: options.groupByType ? suggestGroupedChoices : options.suggest,
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

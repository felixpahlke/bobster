"use strict";

const readline = require("node:readline/promises");
const { Select } = require("enquirer");
const { BobsterError } = require("./error");
const { itemId } = require("./output");

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
  } finally {
    rl.close();
  }
}

async function selectChoice(message: string, choices: any[], options: any = {}) {
  if (!choices.length) {
    return null;
  }

  const prompt = new Select({
    choices,
    limit: options.limit || Math.min(10, choices.length),
    message,
    name: "selection",
    stdin: options.input || process.stdin,
    stdout: options.output || process.stderr,
  });

  try {
    return await prompt.run();
  } catch (error) {
    throw new BobsterError("Selection cancelled.");
  }
}

function itemChoice(item) {
  return {
    name: itemId(item),
    message: `${itemId(item)}  ${item.description || ""}`.trimEnd(),
  };
}

async function selectItem(message: string, items: any[], options: any = {}) {
  const selectedId = await selectChoice(message, items.map(itemChoice), options);
  if (!selectedId) {
    return null;
  }
  return items.find((item) => itemId(item) === selectedId) || null;
}

module.exports = {
  canPrompt,
  confirm,
  selectChoice,
  selectItem,
};

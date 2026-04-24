"use strict";

const readline = require("node:readline/promises");

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

module.exports = {
  confirm,
};

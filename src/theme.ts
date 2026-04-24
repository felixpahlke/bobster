"use strict";

const pc = require("picocolors");

function createTheme(enabled) {
  const color = pc.createColors(Boolean(enabled));
  return {
    color,
    danger: color.red,
    dim: color.dim,
    heading: color.bold,
    id: color.cyan,
    success: color.green,
    value: color.magenta,
    warn: color.yellow,
  };
}

module.exports = {
  createTheme,
};

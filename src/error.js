"use strict";

class BobsterError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "BobsterError";
    this.exitCode = options.exitCode || 1;
  }
}

module.exports = {
  BobsterError,
};

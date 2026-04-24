"use strict";

class BobsterError extends Error {
  exitCode: number;

  constructor(message: string, options: any = {}) {
    super(message);
    this.name = "BobsterError";
    this.exitCode = options.exitCode || 1;
  }
}

module.exports = {
  BobsterError,
};

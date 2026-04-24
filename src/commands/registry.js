"use strict";

const { BobsterError } = require("../error");
const { writeRegistryIndex } = require("../registry/build-index");

async function runRegistry(context) {
  const { args, flags, io } = context;
  const action = args[0];

  if (action !== "build" && action !== "validate") {
    throw new BobsterError("Usage: bobster registry <build|validate> [--check]");
  }

  const result = await writeRegistryIndex({
    baseUrl: flags.baseUrl,
    check: flags.check || action === "validate",
  });

  if (flags.json) {
    io.out(JSON.stringify(result.index, null, 2));
    return;
  }

  if (result.checked) {
    io.out("Registry index is valid.");
  } else {
    io.out(`Wrote ${result.indexPath}.`);
  }
}

module.exports = {
  runRegistry,
};

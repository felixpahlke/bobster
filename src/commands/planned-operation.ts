"use strict";

const { BobsterError } = require("../error");
const { applyWritePlan } = require("../fs/write-plan");
const { confirm } = require("../prompt");

function planJson(plan) {
  return {
    creates: plan.creates.map((entry) => entry.displayPath),
    updates: plan.updates.map((entry) => entry.displayPath),
    deletes: plan.deletes.map((entry) => entry.displayPath),
    unchanged: plan.unchanged.map((entry) => entry.displayPath),
    conflicts: plan.conflicts.map((entry) => entry.displayPath),
  };
}

function valueOf(value, context) {
  return typeof value === "function" ? value(context) : value;
}

async function runPlannedOperation(context, options) {
  const { flags, io } = context;

  if (flags.json) {
    io.out(JSON.stringify(valueOf(options.json, context), null, 2));
  } else {
    await options.print(context);
  }

  if (flags.dryRun) {
    return false;
  }

  const confirmSteps = valueOf(options.confirmSteps, context) || [];
  for (const step of confirmSteps) {
    if (Object.prototype.hasOwnProperty.call(step, "when") && !step.when) {
      continue;
    }

    const accepted = await confirm(step.message, {
      input: io.stdin,
      output: io.stderr,
    });
    if (!accepted) {
      throw new BobsterError(step.cancelMessage);
    }
  }

  if (options.beforeApply) {
    await options.beforeApply(context);
  }

  if (options.apply !== false) {
    await applyWritePlan(options.plan, options.applyOptions || { forceConflicts: true });
  }

  if (options.afterApply) {
    await options.afterApply(context);
  }

  if (!flags.json && options.successMessage) {
    io.out(valueOf(options.successMessage, context));
  }

  return true;
}

module.exports = {
  planJson,
  runPlannedOperation,
};

"use strict";

const { BobsterError } = require("../error");
const { itemId } = require("../output");
const { fetchRegistryFile } = require("../registry/fetch-index");
const { loadRegistryCommandContext } = require("./context");
const { resolveRegistryItemForCommand } = require("./resolve");

function requestedFiles(item, flags) {
  if (flags.all) {
    return item.files;
  }

  if (flags.file) {
    if (!item.files.includes(flags.file)) {
      throw new BobsterError(`File "${flags.file}" is not listed for ${itemId(item)}.`);
    }
    return [flags.file];
  }

  return [item.entry];
}

function formatFiles(item, files) {
  if (files.length === 1) {
    return files[0].content.trimEnd();
  }

  return files
    .map((file) => [`--- ${itemId(item)}: ${file.path} ---`, file.content.trimEnd()].join("\n"))
    .join("\n\n");
}

async function runShow(context) {
  const { args, flags, io } = context;
  const name = args[0];
  if (!name) {
    throw new BobsterError("Usage: bobster show <name>");
  }

  const { registryContext } = await loadRegistryCommandContext(context);
  const item = await resolveRegistryItemForCommand(context, registryContext, name, {
    message: "Did you mean one of these? Select an item to show",
  });
  const files = [];

  for (const file of requestedFiles(item, flags)) {
    const payload = await fetchRegistryFile(registryContext, item, file);
    files.push({
      content: payload.content,
      path: file,
      source: payload.source,
    });
  }

  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          item,
          files,
        },
        null,
        2,
      ),
    );
    return;
  }

  io.out(formatFiles(item, files));
}

module.exports = {
  runShow,
};

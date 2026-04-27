"use strict";

const FRAMES = ["-", "\\", "|", "/"];

function canSpin(context) {
  const stream = context?.io?.stderr;
  return Boolean(
    stream?.isTTY &&
    typeof stream.write === "function" &&
    !context?.flags?.json &&
    !context?.env?.CI &&
    !context?.env?.BOBSTER_NO_SPINNER,
  );
}

function clear(stream, length) {
  stream.write(`\r${" ".repeat(length)}\r`);
}

async function withSpinner(context, message, task) {
  if (!canSpin(context)) {
    return task();
  }

  const stream = context.io.stderr;
  let index = 0;
  let lastLength = 0;
  const render = () => {
    const line = `${FRAMES[index % FRAMES.length]} ${message}`;
    index += 1;
    lastLength = Math.max(lastLength, line.length);
    stream.write(`\r${line}`);
  };

  render();
  const timer = setInterval(render, 80);
  timer.unref?.();

  try {
    return await task();
  } finally {
    clearInterval(timer);
    clear(stream, lastLength);
  }
}

module.exports = {
  canSpin,
  withSpinner,
};

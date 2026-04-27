#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;
const binName = typeof packageJson.bin === "object" ? Object.keys(packageJson.bin)[0] : packageName;

const releaseTag = process.env.NPM_RELEASE_TAG || "latest";
const stagingTag = process.env.NPM_STAGING_TAG || "bobster-staged";
const timeoutMs = Number(process.env.NPM_RELEASE_VERIFY_TIMEOUT_MS || 180000);
const intervalMs = Number(process.env.NPM_RELEASE_VERIFY_INTERVAL_MS || 5000);
const forwardedArgs = process.argv.slice(2);
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "bobster-npm-release-"));

if (!packageName || !packageVersion) {
  fail("package.json must define name and version before publishing.");
}

if (releaseTag === stagingTag) {
  fail("NPM_RELEASE_TAG and NPM_STAGING_TAG must be different.");
}

for (const arg of forwardedArgs) {
  if (arg === "--tag" || arg.startsWith("--tag=")) {
    fail("Do not pass --tag to pub:release. Use NPM_RELEASE_TAG or NPM_STAGING_TAG instead.");
  }
}

main();

function main() {
  console.log(`Publishing ${packageName}@${packageVersion} with staging tag ${stagingTag}.`);
  runNpm(["publish", "--tag", stagingTag, "--cache", cacheDir, ...forwardedArgs]);

  waitForVersion(`${packageName}@${packageVersion}`, packageVersion, "published version");

  console.log(`Promoting ${packageName}@${packageVersion} to ${releaseTag}.`);
  runNpm(["dist-tag", "add", `${packageName}@${packageVersion}`, releaseTag, "--cache", cacheDir, ...distTagArgs(forwardedArgs)]);

  waitForVersion(`${packageName}@${releaseTag}`, packageVersion, `${releaseTag} tag`);

  console.log(`Verifying a fresh ${packageName}@${releaseTag} install path.`);
  runNpm([
    "--cache",
    cacheDir,
    "--prefer-online",
    "exec",
    "--yes",
    "--package",
    `${packageName}@${releaseTag}`,
    "--",
    binName,
    "--version",
  ]);

  console.log(`${packageName}@${packageVersion} is published, tagged ${releaseTag}, and installable.`);
}

function distTagArgs(args) {
  return pickNpmArgs(args, new Set(["--otp", "--registry", "--userconfig"]));
}

function viewArgs(args) {
  return pickNpmArgs(args, new Set(["--registry", "--userconfig"]));
}

function pickNpmArgs(args, allowed) {
  const picked = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name] = arg.split("=", 1);
    if (!allowed.has(name)) {
      continue;
    }

    picked.push(arg);
    if (!arg.includes("=") && args[index + 1] && !args[index + 1].startsWith("-")) {
      picked.push(args[index + 1]);
      index += 1;
    }
  }

  return picked;
}

function waitForVersion(spec, expectedVersion, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() <= deadline) {
    const result = runNpm([
      "--cache",
      cacheDir,
      "--prefer-online",
      "view",
      spec,
      "version",
      "--json",
      ...viewArgs(forwardedArgs),
    ], { check: false, quiet: true });

    const version = cleanVersion(result.stdout);
    if (result.status === 0 && version === expectedVersion) {
      console.log(`Verified ${label}: ${spec} -> ${version}.`);
      return;
    }

    lastError = result.stderr || result.stdout || `unexpected version ${version || "<empty>"}`;
    console.log(`Waiting for npm metadata for ${spec}; retrying in ${Math.round(intervalMs / 1000)}s.`);
    sleep(intervalMs);
  }

  fail(`Timed out waiting for ${label} ${spec} to resolve to ${expectedVersion}.\n${lastError.trim()}`);
}

function cleanVersion(value) {
  return String(value || "").trim().replace(/^"|"$/g, "");
}

function runNpm(args, options = {}) {
  const result = spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (options.check !== false && result.status !== 0) {
    process.exit(result.status || 1);
  }

  return result;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

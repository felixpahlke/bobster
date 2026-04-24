"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");
const { main } = require("../src/cli");

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..", "..");
const binPath = path.join(repoRoot, "dist", "src", "cli.js");
const registryPath = path.join(repoRoot, "registry", "index.json");

async function tempProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), "bobster-test-"));
}

async function cli(cwd: string, args: string[], options: any = {}) {
  const stdout = [];
  const stderr = [];
  const io = {
    color: Boolean(options.color),
    stdin: { isTTY: false },
    stderr: { write() {} },
    out(message = "") {
      stdout.push(message);
    },
    err(message = "") {
      stderr.push(message);
    },
  };
  await main(args, { color: options.color, cwd, io });
  return {
    stderr: stderr.join("\n"),
    stdout: stdout.join("\n"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeBundledRuleRegistry(cwd: string) {
  const registryRoot = path.join(cwd, "registry-fixture");
  const ruleRoot = path.join(registryRoot, "rules", "bundled-rule");
  await fs.mkdir(path.join(ruleRoot, "references"), { recursive: true });
  await fs.writeFile(path.join(ruleRoot, "RULE.md"), "# Bundled Rule\n\nUse the supporting reference.\n", "utf8");
  await fs.writeFile(
    path.join(ruleRoot, "references", "details.md"),
    "# Details\n\nExtra rule context.\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(registryRoot, "index.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: "2026-04-24T00:00:00.000Z",
        baseUrl: "https://example.com/registry",
        items: [
          {
            name: "bundled-rule",
            type: "rule",
            version: "0.1.0",
            description: "A bundled rule with supporting markdown references.",
            license: "MIT",
            tags: ["rules", "bundle"],
            path: "rules/bundled-rule",
            files: ["RULE.md", "references/details.md"],
            entry: "RULE.md",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path.join(registryRoot, "index.json");
}

test("init creates config, Bob folders, and custom mode file", async () => {
  const cwd = await tempProject();

  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const config = await readJson(path.join(cwd, "bobster.json"));
  assert.equal(config.target, ".bob");
  assert.equal(config.registry, registryPath);
  assert.equal(await fs.readFile(path.join(cwd, ".bob", "custom_modes.yaml"), "utf8"), "customModes: []\n");
  await fs.access(path.join(cwd, ".bob", "skills"));
  await fs.access(path.join(cwd, ".bob", "rules"));
});

test("init preserves existing Bob folders and custom modes", async () => {
  const cwd = await tempProject();
  const skillPath = path.join(cwd, ".bob", "skills", "local-skill", "SKILL.md");
  const rulePath = path.join(cwd, ".bob", "rules", "local.md");
  const modesPath = path.join(cwd, ".bob", "custom_modes.yaml");
  const modesContent = "customModes:\n  - slug: local\n    name: Local\n";

  await fs.mkdir(path.dirname(skillPath), { recursive: true });
  await fs.mkdir(path.dirname(rulePath), { recursive: true });
  await fs.writeFile(skillPath, "local skill\n", "utf8");
  await fs.writeFile(rulePath, "local rule\n", "utf8");
  await fs.writeFile(modesPath, modesContent, "utf8");

  const output = await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  assert.match(output.stdout, /Existing paths preserved:/);
  assert.match(output.stdout, /\.bob\/custom_modes\.yaml/);
  assert.equal(await fs.readFile(skillPath, "utf8"), "local skill\n");
  assert.equal(await fs.readFile(rulePath, "utf8"), "local rule\n");
  assert.equal(await fs.readFile(modesPath, "utf8"), modesContent);

  const config = await readJson(path.join(cwd, "bobster.json"));
  assert.equal(config.target, ".bob");
  assert.equal(config.registry, registryPath);
});

test("help is available globally, per command, and through help <command>", async () => {
  const cwd = await tempProject();

  const general = await cli(cwd, ["--help"]);
  assert.match(general.stdout, /Bobster/);
  assert.match(general.stdout, /bobster <command> --help/);

  const add = await cli(cwd, ["add", "--help"]);
  assert.match(add.stdout, /Install one registry item/);
  assert.match(add.stdout, /--force/);

  const update = await cli(cwd, ["help", "update"]);
  assert.match(update.stdout, /Reinstall installed items/);

  const registry = await cli(cwd, ["registry", "--help"]);
  assert.match(registry.stdout, /build\|validate/);
});

test("terminal output is styled when color is enabled and JSON stays plain", async () => {
  const cwd = await tempProject();

  const pretty = await cli(cwd, ["list", "--registry", registryPath], { color: true });
  assert.match(pretty.stdout, /\x1b\[/);
  assert.match(pretty.stdout, /frontend-design/);

  const json = await cli(cwd, ["list", "--registry", registryPath, "--json"], { color: true });
  assert.doesNotMatch(json.stdout, /\x1b\[/);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.some((item) => item.name === "frontend-design"), true);
});

test("add installs skill, rule, and mode and writes a lockfile", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);
  await cli(cwd, ["add", "rule/no-secrets", "--yes"]);
  await cli(cwd, ["add", "mode/grug-brained", "--yes"]);
  await cli(cwd, ["add", "mode/planner", "--yes"]);

  await fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md"));
  assert.match(await fs.readFile(path.join(cwd, ".bob", "rules", "no-secrets.md"), "utf8"), /Do not commit credentials/);
  const modes = await fs.readFile(path.join(cwd, ".bob", "custom_modes.yaml"), "utf8");
  assert.match(modes, /slug: grug-brained/);
  assert.match(modes, /slug: planner/);

  const lockfile = await readJson(path.join(cwd, "bobster-lock.json"));
  assert.deepEqual(
    lockfile.items.map((item) => `${item.type}/${item.name}`).sort(),
    ["mode/grug-brained", "mode/planner", "rule/no-secrets", "skill/frontend-design"],
  );
});

test("bundled rules install as directories while single-file rules stay flat", async () => {
  const cwd = await tempProject();
  const bundledRegistryPath = await writeBundledRuleRegistry(cwd);
  await cli(cwd, ["init", "--registry", bundledRegistryPath, "--yes"]);

  const info = await cli(cwd, ["info", "rule/bundled-rule"]);
  assert.match(info.stdout, /\.bob\/rules\/bundled-rule\//);

  await cli(cwd, ["add", "rule/bundled-rule", "--yes"]);

  assert.match(
    await fs.readFile(path.join(cwd, ".bob", "rules", "bundled-rule", "RULE.md"), "utf8"),
    /Bundled Rule/,
  );
  assert.match(
    await fs.readFile(path.join(cwd, ".bob", "rules", "bundled-rule", "references", "details.md"), "utf8"),
    /Extra rule context/,
  );

  const lockfile = await readJson(path.join(cwd, "bobster-lock.json"));
  assert.deepEqual(lockfile.items[0].files.sort(), [
    ".bob/rules/bundled-rule/RULE.md",
    ".bob/rules/bundled-rule/references/details.md",
  ]);

  const flatCwd = await tempProject();
  await cli(flatCwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(flatCwd, ["add", "rule/no-secrets", "--yes"]);
  await fs.access(path.join(flatCwd, ".bob", "rules", "no-secrets.md"));
});

test("dry-run and JSON add output report planned writes without touching disk", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const output = await cli(cwd, ["add", "skill/frontend-design", "--dry-run", "--json"]);
  const plan = JSON.parse(output.stdout);
  assert.deepEqual(plan.plan.creates, [".bob/skills/frontend-design/SKILL.md"]);

  await assert.rejects(
    () => fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md")),
    /ENOENT/,
  );
  await assert.rejects(() => fs.access(path.join(cwd, "bobster-lock.json")), /ENOENT/);
});

test("learn alias installs a skill", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  await cli(cwd, ["learn", "frontend-design", "--yes"]);

  await fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md"));
});

test("watsonx Orchestrate skill is searchable and installable", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const search = await cli(cwd, ["search", "wxo", "--registry", registryPath]);
  assert.match(search.stdout, /skill\/watsonx-orchestrate/);

  await cli(cwd, ["add", "skill/watsonx-orchestrate", "--yes"]);

  const skill = await fs.readFile(
    path.join(cwd, ".bob", "skills", "watsonx-orchestrate", "SKILL.md"),
    "utf8",
  );
  assert.match(skill, /uv run orchestrate --help/);
});

test("reinstall is idempotent and add without force refuses conflicts", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);

  const second = await cli(cwd, ["add", "skill/frontend-design", "--yes"]);
  assert.match(second.stdout, /already installed/);

  await fs.writeFile(
    path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md"),
    "local edit\n",
    "utf8",
  );

  await assert.rejects(
    () => cli(cwd, ["add", "skill/frontend-design", "--yes"]),
    /Install cancelled/,
  );
});

test("remove deletes tracked files and removes custom mode entries", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);
  await cli(cwd, ["add", "mode/grug-brained", "--yes"]);

  await cli(cwd, ["remove", "mode/grug-brained", "--yes"]);
  assert.equal(await fs.readFile(path.join(cwd, ".bob", "custom_modes.yaml"), "utf8"), "customModes: []\n");

  await cli(cwd, ["remove", "skill/frontend-design", "--yes"]);
  await assert.rejects(
    () => fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md")),
    /ENOENT/,
  );
});

test("update repairs installed files from the configured registry", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(cwd, ["add", "rule/no-secrets", "--yes"]);

  const rulePath = path.join(cwd, ".bob", "rules", "no-secrets.md");
  await fs.writeFile(rulePath, "local edit\n", "utf8");
  await cli(cwd, ["update", "rule/no-secrets", "--yes"]);

  assert.match(await fs.readFile(rulePath, "utf8"), /Do not commit credentials/);
});

test("bin entrypoint can run help and registry-backed search", async () => {
  const cwd = await tempProject();

  const help = await execFileAsync(process.execPath, [binPath, "--help"], { cwd });
  assert.match(help.stdout, /Bobster/);

  const search = await execFileAsync(
    process.execPath,
    [binPath, "search", "security", "--registry", registryPath],
    { cwd },
  );
  assert.match(search.stdout, /rule\/no-secrets/);
});

"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");
const { main } = require("../src/cli");
const { validateManifest } = require("../src/registry/schemas");

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..", "..");
const binPath = path.join(repoRoot, "dist", "src", "cli.js");
const packageJson = require(path.join(repoRoot, "package.json"));
const registryPath = path.join(repoRoot, "registry", "index.json");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function tempProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), "bobster-test-"));
}

async function cli(cwd: string, args: string[], options: any = {}) {
  const stdout = [];
  const stderr = [];
  const io = {
    color: Boolean(options.color),
    stdin: { isTTY: false },
    stderr: { isTTY: Boolean(options.stderrTty), write() {} },
    out(message = "") {
      stdout.push(message);
    },
    err(message = "") {
      stderr.push(message);
    },
  };
  await main(args, { color: options.color, cwd, io, updateCheck: options.updateCheck });
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

async function writeRuleRegistry(cwd: string, folder: string, itemName: string, body: string) {
  const registryRoot = path.join(cwd, folder);
  const ruleRoot = path.join(registryRoot, "rules", itemName);
  await fs.mkdir(ruleRoot, { recursive: true });
  await fs.writeFile(path.join(ruleRoot, "RULE.md"), body, "utf8");
  await fs.writeFile(
    path.join(registryRoot, "index.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: "2026-04-24T00:00:00.000Z",
        baseUrl: "https://example.com/registry",
        items: [
          {
            name: itemName,
            type: "rule",
            version: "0.1.0",
            description: `Rule from ${folder}.`,
            tags: ["rules"],
            path: `rules/${itemName}`,
            files: ["RULE.md"],
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
  assert.match(general.stdout, /CORE COMMANDS/);
  assert.match(general.stdout, /add:\s+Install or interactively pick an item/);
  assert.match(general.stdout, /bobster <command> --help/);
  assert.doesNotMatch(general.stdout, /\[--target/);
  assert.doesNotMatch(general.stdout, /\[--dry-run/);

  const add = await cli(cwd, ["add", "--help"]);
  assert.match(add.stdout, /Install one registry item/);
  assert.match(add.stdout, /--force/);

  const update = await cli(cwd, ["help", "update"]);
  assert.match(update.stdout, /Reinstall installed items/);

  const show = await cli(cwd, ["show", "--help"]);
  assert.match(show.stdout, /Print the registry item contents/);
  assert.match(show.stdout, /--all/);

  const registry = await cli(cwd, ["registry", "--help"]);
  assert.match(registry.stdout, /add\|list\|remove\|doctor\|build\|validate/);
});

test("registry add, list, doctor, and remove manage project registries", async () => {
  const cwd = await tempProject();
  const teamRegistryPath = await writeRuleRegistry(cwd, "team-registry", "team-rule", "# Team Rule\n");

  await cli(cwd, ["registry", "add", "team", teamRegistryPath]);

  const config = await readJson(path.join(cwd, "bobster.json"));
  assert.deepEqual(
    config.registries.map((registry) => registry.name),
    ["public", "team"],
  );
  assert.equal(config.registries[1].url, teamRegistryPath);

  const list = await cli(cwd, ["registry", "list"]);
  assert.match(list.stdout, /public\s+/);
  assert.match(list.stdout, new RegExp(`team\\s+${escapeRegExp(teamRegistryPath)}`));

  const doctor = await cli(cwd, ["registry", "doctor", "team"]);
  assert.match(doctor.stdout, /team: ok \(1 items\)/);

  await cli(cwd, ["registry", "remove", "team"]);
  const updated = await readJson(path.join(cwd, "bobster.json"));
  assert.deepEqual(
    updated.registries.map((registry) => registry.name),
    ["public"],
  );
});

test("completion suggests registry skills and rules", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const unqualified = await cli(cwd, ["__complete", "--", "add", "wats"]);
  assert.match(unqualified.stdout, /^watsonx-orchestrate$/m);
  assert.doesNotMatch(unqualified.stdout, /^skill\/watsonx-orchestrate$/m);

  const skills = await cli(cwd, ["__complete", "--", "add", "skill/wats"]);
  assert.match(skills.stdout, /^skill\/watsonx-orchestrate$/m);
  assert.doesNotMatch(skills.stdout, /^watsonx-orchestrate$/m);

  const allSkills = await cli(cwd, ["__complete", "--", "add", "skill/"]);
  assert.match(allSkills.stdout, /^skill\/frontend-design$/m);
  assert.match(allSkills.stdout, /^skill\/watsonx-orchestrate$/m);
  assert.doesNotMatch(allSkills.stdout, /^rule\/no-secrets$/m);

  const rules = await cli(cwd, ["__complete", "--", "info", "rule/"]);
  assert.match(rules.stdout, /^rule\/no-secrets$/m);
  assert.match(rules.stdout, /^rule\/typescript-quality$/m);
  assert.doesNotMatch(rules.stdout, /^skill\/frontend-design$/m);

  const show = await cli(cwd, ["__complete", "--", "show", "front"]);
  assert.match(show.stdout, /^frontend-design$/m);

  const topic = await cli(cwd, ["__complete", "--", "list", "sec"]);
  assert.match(topic.stdout, /^security$/m);
});

test("completion hooks are printable and avoid filename fallback", async () => {
  const cwd = await tempProject();
  const zsh = await cli(cwd, ["completion", "zsh"]);
  const bash = await cli(cwd, ["completion", "bash"]);
  const fish = await cli(cwd, ["completion", "fish"]);

  assert.match(zsh.stdout, /#compdef bobster/);
  assert.match(zsh.stdout, /bobster __complete/);
  assert.doesNotMatch(zsh.stdout, /_files/);

  assert.match(bash.stdout, /bobster __complete/);
  assert.doesNotMatch(bash.stdout, /-o default/);

  assert.match(fish.stdout, /bobster __complete/);
  assert.match(fish.stdout, /complete -c bobster -f/);
});

test("completion install writes shell hook and managed zsh config", async () => {
  const cwd = await tempProject();
  const home = await tempProject();
  const previousHome = process.env.HOME;
  const previousZdotdir = process.env.ZDOTDIR;

  process.env.HOME = home;
  delete process.env.ZDOTDIR;
  try {
    const output = await cli(cwd, ["completion", "install", "zsh", "--yes"]);

    assert.match(output.stdout, /Completion install plan:/);
    assert.match(output.stdout, /Installed zsh completion/);
    assert.match(await fs.readFile(path.join(home, ".zfunc", "_bobster"), "utf8"), /bobster __complete/);
    const zshrc = await fs.readFile(path.join(home, ".zshrc"), "utf8");
    assert.match(zshrc, /# >>> bobster completion >>>/);
    assert.match(zshrc, /fpath=\("\$HOME\/\.zfunc" \$fpath\)/);

    await cli(cwd, ["completion", "install", "zsh", "--yes"]);
    const rerunZshrc = await fs.readFile(path.join(home, ".zshrc"), "utf8");
    assert.equal((rerunZshrc.match(/# >>> bobster completion >>>/g) || []).length, 1);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousZdotdir === undefined) {
      delete process.env.ZDOTDIR;
    } else {
      process.env.ZDOTDIR = previousZdotdir;
    }
  }
});

test("completion honors type filters and installed item commands", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);
  await cli(cwd, ["add", "rule/no-secrets", "--yes"]);

  const learned = await cli(cwd, ["__complete", "--", "learn", ""]);
  assert.match(learned.stdout, /^frontend-design$/m);
  assert.doesNotMatch(learned.stdout, /^skill\/frontend-design$/m);
  assert.doesNotMatch(learned.stdout, /^no-secrets$/m);

  const typed = await cli(cwd, ["__complete", "--", "remove", "--type", "rule", ""]);
  assert.match(typed.stdout, /^no-secrets$/m);
  assert.doesNotMatch(typed.stdout, /^frontend-design$/m);

  const installed = await cli(cwd, ["__complete", "--", "update", ""]);
  assert.match(installed.stdout, /^rule\/no-secrets$/m);
  assert.match(installed.stdout, /^skill\/frontend-design$/m);
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

test("registry manifests reject obsolete per-item license metadata", () => {
  assert.throws(
    () =>
      validateManifest({
        name: "licensed-item",
        type: "rule",
        version: "0.1.0",
        description: "A rule that still has old license metadata.",
        license: "MIT",
        tags: ["rules"],
        files: ["RULE.md"],
        entry: "RULE.md",
      }),
    /license is not allowed/,
  );
});

test("registry manifests allow origin provenance metadata", () => {
  assert.doesNotThrow(() =>
    validateManifest({
      name: "origin-item",
      type: "rule",
      version: "0.1.0",
      description: "A rule with original source metadata.",
      tags: ["rules"],
      files: ["RULE.md"],
      entry: "RULE.md",
      origin: {
        url: "https://github.example.com/team/source/blob/main/RULE.md",
        path: "RULE.md",
        ref: "main",
        sha: "abc123",
        importedAt: "2026-04-27T00:00:00.000Z",
        notes: "Imported for private review.",
      },
    }),
  );
});

test("registry manifests allow discovery metadata", () => {
  assert.doesNotThrow(() =>
    validateManifest({
      name: "discoverable-item",
      type: "rule",
      version: "0.1.0",
      description: "A rule with extra search and catalog metadata.",
      tags: ["security"],
      topics: ["security"],
      aliases: ["appsec", "secure coding"],
      keywords: ["credentials", "tokens"],
      status: "stable",
      files: ["RULE.md"],
      entry: "RULE.md",
    }),
  );
});

test("interactive global-style runs suggest package updates without changing stdout", async () => {
  const cwd = await tempProject();
  const output = await cli(cwd, ["list", "--registry", registryPath], {
    stderrTty: true,
    updateCheck: {
      cacheFile: path.join(cwd, "update-cache.json"),
      fetchLatestVersion: async () => "99.0.0",
      force: true,
      now: () => 1000,
    },
  });

  assert.match(output.stdout, /frontend-design/);
  assert.match(
    output.stderr,
    new RegExp(`Update available: ${escapeRegExp(packageJson.name)} ${escapeRegExp(packageJson.version)} -> 99\\.0\\.0`),
  );
  assert.match(output.stderr, new RegExp(`npm install -g ${escapeRegExp(packageJson.name)}@latest`));
  assert.match(output.stderr, new RegExp(`npx ${escapeRegExp(packageJson.name)}@latest <command>`));
});

test("update checks are skipped for JSON output", async () => {
  const cwd = await tempProject();
  let fetched = false;
  const output = await cli(cwd, ["list", "--registry", registryPath, "--json"], {
    stderrTty: true,
    updateCheck: {
      cacheFile: path.join(cwd, "update-cache.json"),
      fetchLatestVersion: async () => {
        fetched = true;
        return "99.0.0";
      },
      force: true,
      now: () => 1000,
    },
  });

  assert.equal(fetched, false);
  assert.equal(output.stderr, "");
  JSON.parse(output.stdout);
});

test("add installs skill, rule, and mode and writes a lockfile", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);
  await cli(cwd, ["add", "rule/no-secrets", "--yes"]);
  await cli(cwd, ["add", "mode/grug-brained", "--yes"]);

  await fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md"));
  assert.match(await fs.readFile(path.join(cwd, ".bob", "rules", "no-secrets.md"), "utf8"), /Do not commit credentials/);
  const modes = await fs.readFile(path.join(cwd, ".bob", "custom_modes.yaml"), "utf8");
  assert.match(modes, /slug: grug-brained/);

  const lockfile = await readJson(path.join(cwd, "bobster-lock.json"));
  assert.deepEqual(
    lockfile.items.map((item) => `${item.type}/${item.name}`).sort(),
    ["mode/grug-brained", "rule/no-secrets", "skill/frontend-design"],
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

test("multiple registries resolve and install registry-qualified items", async () => {
  const cwd = await tempProject();
  const teamRegistryPath = await writeRuleRegistry(cwd, "team-registry", "team-rule", "# Team Rule\n");
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const configPath = path.join(cwd, "bobster.json");
  const config = await readJson(configPath);
  config.registries = [
    { name: "public", url: registryPath },
    { name: "team", url: teamRegistryPath },
  ];
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const list = await cli(cwd, ["list"]);
  assert.match(list.stdout, /public\/skill\/frontend-design/);
  assert.match(list.stdout, /team\/rule\/team-rule/);

  const teamOnly = await cli(cwd, ["list", "--registry", "team"]);
  assert.match(teamOnly.stdout, /team-rule/);
  assert.doesNotMatch(teamOnly.stdout, /frontend-design/);

  await cli(cwd, ["add", "team/rule/team-rule", "--yes"]);
  assert.match(await fs.readFile(path.join(cwd, ".bob", "rules", "team-rule.md"), "utf8"), /Team Rule/);

  const lockfile = await readJson(path.join(cwd, "bobster-lock.json"));
  assert.equal(lockfile.items[0].registry, "team");
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

test("catalog and search use discovery metadata", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);

  const catalog = await cli(cwd, ["list", "--registry", registryPath]);
  assert.match(catalog.stdout, /Popular Topics/);
  assert.match(catalog.stdout, /Recommended/);
  assert.match(catalog.stdout, /Security/);

  const topic = await cli(cwd, ["list", "appsec", "--registry", registryPath]);
  assert.match(topic.stdout, /rule\/no-secrets/);

  const phrase = await cli(cwd, ["search", "secure coding", "--registry", registryPath]);
  assert.match(phrase.stdout, /rule\/no-secrets/);

  const info = await cli(cwd, ["info", "rule/no-secrets", "--registry", registryPath]);
  assert.match(info.stdout, /Topics:/);
  assert.match(info.stdout, /Aliases:/);
  assert.match(info.stdout, /Status:/);
});

test("add suggests close registry names for typos", async () => {
  const cwd = await tempProject();

  await assert.rejects(
    () => cli(cwd, ["add", "frntend-design", "--registry", registryPath, "--yes"]),
    /Did you mean one of these\?[\s\S]*skill\/frontend-design/,
  );
});

test("ambiguous items require registry-qualified names", async () => {
  const cwd = await tempProject();
  const publicRegistryPath = await writeRuleRegistry(cwd, "public-registry", "shared-rule", "# Public Rule\n");
  const teamRegistryPath = await writeRuleRegistry(cwd, "team-registry", "shared-rule", "# Team Rule\n");
  await cli(cwd, ["init", "--registry", publicRegistryPath, "--yes"]);

  const configPath = path.join(cwd, "bobster.json");
  const config = await readJson(configPath);
  config.registries = [
    { name: "public", url: publicRegistryPath },
    { name: "team", url: teamRegistryPath },
  ];
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => cli(cwd, ["add", "rule/shared-rule", "--yes"]),
    /Multiple items found[\s\S]*public\/rule\/shared-rule[\s\S]*team\/rule\/shared-rule/,
  );

  await cli(cwd, ["add", "team/rule/shared-rule", "--yes"]);
  assert.match(await fs.readFile(path.join(cwd, ".bob", "rules", "shared-rule.md"), "utf8"), /Team Rule/);
});

test("GitHub blob registry URLs derive API fetch URLs", () => {
  const { githubBlobInfo } = require("../src/registry/fetch-index");
  assert.deepEqual(
    githubBlobInfo("https://github.example.com/team/repo/blob/main/registry/index.json"),
    {
      host: "github.example.com",
      owner: "team",
      path: "registry/index.json",
      ref: "main",
      repo: "repo",
    },
  );
});

test("installed item commands suggest close installed names for typos", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--registry", registryPath, "--yes"]);
  await cli(cwd, ["add", "skill/frontend-design", "--yes"]);

  await assert.rejects(
    () => cli(cwd, ["remove", "frntend-design", "--yes"]),
    /Did you mean one of these\?[\s\S]*skill\/frontend-design/,
  );
});

test("show prints registry item contents", async () => {
  const cwd = await tempProject();
  const output = await cli(cwd, ["show", "rule/no-secrets", "--registry", registryPath]);

  assert.match(output.stdout, /Do not commit credentials/);
  assert.doesNotMatch(output.stdout, /^---/m);

  const json = await cli(cwd, ["show", "rule/no-secrets", "--registry", registryPath, "--json"]);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.item.name, "no-secrets");
  assert.equal(parsed.files[0].path, "RULE.md");
  assert.match(parsed.files[0].content, /Do not commit credentials/);
});

test("show all prints every manifest file with headers", async () => {
  const cwd = await tempProject();
  const bundledRegistryPath = await writeBundledRuleRegistry(cwd);
  const output = await cli(cwd, ["show", "rule/bundled-rule", "--registry", bundledRegistryPath, "--all"]);

  assert.match(output.stdout, /--- rule\/bundled-rule: RULE\.md ---/);
  assert.match(output.stdout, /--- rule\/bundled-rule: references\/details\.md ---/);
  assert.match(output.stdout, /Extra rule context/);
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

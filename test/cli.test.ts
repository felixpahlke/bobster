"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { promisify } = require("node:util");
const test = require("node:test");
const { main } = require("../src/cli");
const { fetchRegistryIndex } = require("../src/registry/fetch-index");
const { validateManifest } = require("../src/registry/schemas");
const { withSpinner } = require("../src/spinner");

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..", "..");
const binPath = path.join(repoRoot, "dist", "src", "cli.js");
const packageJson = require(path.join(repoRoot, "package.json"));
const registryPath = path.join(repoRoot, "registry", "index.json");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function testGlobalConfigPath(cwd: string) {
  return path.join(cwd, ".bobster-config.json");
}

async function writeTestGlobalConfig(cwd: string, registries: any[] = [{ name: "public", url: registryPath }]) {
  await fs.writeFile(
    testGlobalConfigPath(cwd),
    `${JSON.stringify({ registries }, null, 2)}\n`,
    "utf8",
  );
}

async function tempProject() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bobster-test-"));
  await writeTestGlobalConfig(cwd);
  return cwd;
}

function testEnv(cwd: string) {
  return {
    ...process.env,
    BOBSTER_CACHE: path.join(cwd, ".bobster-cache"),
    BOBSTER_CONFIG: testGlobalConfigPath(cwd),
  };
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
  await main(args, {
    color: options.color,
    cwd,
    env: options.env || testEnv(cwd),
    io,
    updateCheck: options.updateCheck,
  });
  return {
    stderr: stderr.join("\n"),
    stdout: stdout.join("\n"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function ttyStream() {
  const stream = new PassThrough();
  stream.isTTY = true;
  stream.isRaw = false;
  stream.columns = 80;
  stream.setRawMode = (value) => {
    stream.isRaw = value;
  };
  return stream;
}

test("spinner writes only to interactive stderr and skips json output", async () => {
  const writes = [];
  const stderr = {
    isTTY: true,
    write(value) {
      writes.push(value);
      return true;
    },
  };

  const result = await withSpinner(
    { env: {}, flags: {}, io: { stderr } },
    "Loading registries...",
    async () => "done",
  );
  assert.equal(result, "done");
  assert.match(writes.join(""), /Loading registries\.\.\./);

  writes.length = 0;
  await withSpinner(
    { env: {}, flags: { json: true }, io: { stderr } },
    "Loading registries...",
    async () => "json",
  );
  assert.equal(writes.length, 0);
});

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

async function writeModeRegistry(cwd: string, folder: string, itemName: string, modeYaml: string) {
  const registryRoot = path.join(cwd, folder);
  const modeRoot = path.join(registryRoot, "modes", itemName);
  await fs.mkdir(modeRoot, { recursive: true });
  await fs.writeFile(path.join(modeRoot, "mode.yaml"), modeYaml, "utf8");
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
            type: "mode",
            version: "0.1.0",
            description: `Mode from ${folder}.`,
            tags: ["mode"],
            path: `modes/${itemName}`,
            files: ["mode.yaml"],
            entry: "mode.yaml",
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

async function writeSkillRegistry(cwd: string, folder: string, itemName: string, skillMarkdown: string) {
  const registryRoot = path.join(cwd, folder);
  const skillRoot = path.join(registryRoot, "skills", itemName);
  await fs.mkdir(skillRoot, { recursive: true });
  await fs.writeFile(path.join(skillRoot, "SKILL.md"), skillMarkdown, "utf8");
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
            type: "skill",
            version: "0.1.0",
            description: "Production-grade OpenShift DevOps guidance for GitOps, pipelines, security, operations, troubleshooting, and Day-2 readiness.",
            tags: ["skill"],
            path: `skills/${itemName}`,
            files: ["SKILL.md"],
            entry: "SKILL.md",
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

  await cli(cwd, ["init", "--yes"]);

  const config = await readJson(path.join(cwd, "bobster.json"));
  assert.equal(config.target, ".bob");
  assert.equal(config.registry, undefined);
  assert.equal(config.registries, undefined);
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

  const output = await cli(cwd, ["init", "--yes"]);

  assert.match(output.stdout, /Existing paths preserved:/);
  assert.match(output.stdout, /\.bob\/custom_modes\.yaml/);
  assert.equal(await fs.readFile(skillPath, "utf8"), "local skill\n");
  assert.equal(await fs.readFile(rulePath, "utf8"), "local rule\n");
  assert.equal(await fs.readFile(modesPath, "utf8"), modesContent);

  const config = await readJson(path.join(cwd, "bobster.json"));
  assert.equal(config.target, ".bob");
  assert.equal(config.registry, undefined);
  assert.equal(config.registries, undefined);
});

test("init does not accept registry configuration", async () => {
  const cwd = await tempProject();

  await assert.rejects(
    () => cli(cwd, ["init", "--registry", registryPath, "--yes"]),
    /bobster init no longer configures registries/,
  );
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

test("registry add, list, doctor, and remove manage global registries", async () => {
  const cwd = await tempProject();
  const teamRegistryPath = await writeRuleRegistry(cwd, "team-registry", "team-rule", "# Team Rule\n");

  await cli(cwd, ["registry", "add", "team", teamRegistryPath]);

  await assert.rejects(() => fs.access(path.join(cwd, "bobster.json")), /ENOENT/);
  const config = await readJson(testGlobalConfigPath(cwd));
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
  const updated = await readJson(testGlobalConfigPath(cwd));
  assert.deepEqual(
    updated.registries.map((registry) => registry.name),
    ["public"],
  );
});

test("project bobster.json registry fields do not configure registries", async () => {
  const cwd = await tempProject();
  const projectRegistryPath = await writeRuleRegistry(cwd, "project-registry", "project-rule", "# Project Rule\n");
  await fs.writeFile(
    path.join(cwd, "bobster.json"),
    `${JSON.stringify({ target: ".bob", registries: [{ name: "project", url: projectRegistryPath }] }, null, 2)}\n`,
    "utf8",
  );

  const list = await cli(cwd, ["list"]);
  assert.doesNotMatch(list.stdout, /project-rule/);
  assert.match(list.stdout, /frontend-design/);
});

test("registry add accepts SSH Git registry shorthand without a project checkout", async () => {
  const cwd = await tempProject();

  await cli(cwd, ["registry", "add", "ssh/git@github.ibm.com:Felix-Pahlke/bobster-registry-internal.git"]);

  await assert.rejects(() => fs.access(path.join(cwd, ".private-registries")), /ENOENT/);
  const config = await readJson(testGlobalConfigPath(cwd));
  assert.deepEqual(
    config.registries.map((registry) => registry.name),
    ["public", "internal"],
  );
  assert.equal(
    config.registries[1].url,
    "git@github.ibm.com:Felix-Pahlke/bobster-registry-internal.git",
  );
});

test("SSH Git registry sources parse optional prefixes", () => {
  const { parseSshGitRegistrySource } = require("../src/commands/registry");

  assert.deepEqual(
    parseSshGitRegistrySource("ssh/git@github.ibm.com:Felix-Pahlke/bobster-registry-internal.git"),
    {
      name: "internal",
      remote: "git@github.ibm.com:Felix-Pahlke/bobster-registry-internal.git",
      repoName: "bobster-registry-internal",
    },
  );
  assert.deepEqual(
    parseSshGitRegistrySource("ssh://git@github.ibm.com/Felix-Pahlke/bobster-registry-internal.git"),
    {
      name: "internal",
      remote: "ssh://git@github.ibm.com/Felix-Pahlke/bobster-registry-internal.git",
      repoName: "bobster-registry-internal",
    },
  );
});

test("GitHub repository tree registry URLs resolve to raw index content", async () => {
  const originalFetch = (global as any).fetch;
  const seen = [];
  (global as any).fetch = async (url, options) => {
    seen.push({ options, url: String(url) });
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          schemaVersion: 1,
          generatedAt: "2026-04-24T00:00:00.000Z",
          baseUrl: "https://github.ibm.com/Felix-Pahlke/bobster-registry-internal/tree/main/registry",
          items: [],
        });
      },
    };
  };

  try {
    const context = await fetchRegistryIndex(
      "https://github.ibm.com/Felix-Pahlke/bobster-registry-internal/tree/main",
    );
    assert.equal(context.index.items.length, 0);
    assert.equal(
      seen[0].url,
      "https://github.ibm.com/api/v3/repos/Felix-Pahlke/bobster-registry-internal/contents/registry/index.json?ref=main",
    );
    assert.equal(seen[0].options.headers.Accept, "application/vnd.github.raw");
  } finally {
    (global as any).fetch = originalFetch;
  }
});

test("completion suggests registry skills and rules", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--yes"]);

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
  await cli(cwd, ["init", "--yes"]);
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
  await cli(cwd, ["init", "--yes"]);

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

test("add normalizes folded skill frontmatter scalars", async () => {
  const cwd = await tempProject();
  const skillRegistryPath = await writeSkillRegistry(
    cwd,
    "skill-registry",
    "openshift-devops",
    [
      "---",
      "name: openshift-devops",
      "description: >",
      "  Production-grade OpenShift DevOps.",
      "  Even if the user says \"deploy this to OpenShift\", activate this skill.",
      "---",
      "",
      "# OpenShift DevOps",
      "",
      "Build production-ready OpenShift assets.",
      "",
    ].join("\n"),
  );

  await cli(cwd, ["add", "skill/openshift-devops", "--registry", skillRegistryPath, "--yes"]);

  assert.equal(
    await fs.readFile(path.join(cwd, ".bob", "skills", "openshift-devops", "SKILL.md"), "utf8"),
    [
      "---",
      "name: openshift-devops",
      "description: Production-grade OpenShift DevOps. Even if the user says \"deploy this to OpenShift\", activate this skill.",
      "---",
      "",
      "# OpenShift DevOps",
      "",
      "Build production-ready OpenShift assets.",
      "",
    ].join("\n"),
  );
});

test("add preserves existing skill frontmatter descriptions", async () => {
  const cwd = await tempProject();
  const skillRegistryPath = await writeSkillRegistry(
    cwd,
    "skill-registry",
    "quoted-skill",
    [
      "---",
      "name: quoted-skill",
      "description: Source description with \"nested quotes\" that should be preserved.",
      "---",
      "",
      "# Quoted Skill",
      "",
    ].join("\n"),
  );

  await cli(cwd, ["add", "skill/quoted-skill", "--registry", skillRegistryPath, "--yes"]);

  assert.match(
    await fs.readFile(path.join(cwd, ".bob", "skills", "quoted-skill", "SKILL.md"), "utf8"),
    /^description: Source description with "nested quotes" that should be preserved\.$/m,
  );
});

test("add normalizes unindented mode field content", async () => {
  const cwd = await tempProject();
  const modeRegistryPath = await writeModeRegistry(
    cwd,
    "mode-registry",
    "security-reviewer",
    [
      "slug: security-reviewer",
      "name: Security Reviewer",
      "roleDefinition: >-",
      "Review the code for security issues.",
      "- Cite exact evidence.",
      "  Include line numbers.",
      "whenToUse: >-",
      "Use during security reviews.",
      "groups:",
      "- read",
      "- command",
      "source: project",
      "rulesFiles:",
      "- relativePath: security.md",
      "  content: >",
      "    # Security protocol",
    ].join("\n"),
  );
  await cli(cwd, ["add", "mode/security-reviewer", "--registry", modeRegistryPath, "--yes"]);

  assert.equal(
    await fs.readFile(path.join(cwd, ".bob", "custom_modes.yaml"), "utf8"),
    [
      "customModes:",
      "  - slug: security-reviewer",
      "    name: Security Reviewer",
      "    roleDefinition: >-",
      "      Review the code for security issues.",
      "      - Cite exact evidence.",
      "        Include line numbers.",
      "    whenToUse: >-",
      "      Use during security reviews.",
      "    groups:",
      "      - read",
      "      - command",
      "    source: project",
      "    rulesFiles:",
      "      - relativePath: security.md",
      "        content: >",
      "          # Security protocol",
      "",
    ].join("\n"),
  );
});

test("bundled rules install as directories while single-file rules stay flat", async () => {
  const cwd = await tempProject();
  const bundledRegistryPath = await writeBundledRuleRegistry(cwd);
  await writeTestGlobalConfig(cwd, [{ name: "public", url: bundledRegistryPath }]);
  await cli(cwd, ["init", "--yes"]);

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
  await cli(flatCwd, ["init", "--yes"]);
  await cli(flatCwd, ["add", "rule/no-secrets", "--yes"]);
  await fs.access(path.join(flatCwd, ".bob", "rules", "no-secrets.md"));
});

test("multiple registries resolve and install registry-qualified items", async () => {
  const cwd = await tempProject();
  const teamRegistryPath = await writeRuleRegistry(cwd, "team-registry", "team-rule", "# Team Rule\n");
  await writeTestGlobalConfig(cwd, [
    { name: "public", url: registryPath },
    { name: "team", url: teamRegistryPath },
  ]);
  await cli(cwd, ["init", "--yes"]);

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
  await cli(cwd, ["init", "--yes"]);

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
  await cli(cwd, ["init", "--yes"]);

  await cli(cwd, ["learn", "frontend-design", "--yes"]);

  await fs.access(path.join(cwd, ".bob", "skills", "frontend-design", "SKILL.md"));
});

test("watsonx Orchestrate skill is searchable and installable", async () => {
  const cwd = await tempProject();
  await cli(cwd, ["init", "--yes"]);

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
  await cli(cwd, ["init", "--yes"]);

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

test("bare add queries offer discovery matches before installing exact names", async () => {
  const { resolveRegistryItemForCommand, searchMatchesForBareRegistryQuery } = require("../src/commands/resolve");
  const index = {
    items: [
      {
        name: "security",
        type: "mode",
        version: "0.1.0",
        description: "Security review mode.",
        tags: ["mode"],
      },
      {
        name: "no-secrets",
        type: "rule",
        version: "0.1.0",
        description: "Prevent credential leaks.",
        tags: ["security", "secrets"],
        topics: ["security"],
        aliases: ["secure coding"],
      },
    ],
  };
  const context = {
    flags: {},
    io: {
      stdin: { isTTY: true },
      stderr: { isTTY: true },
    },
  };

  const matches = searchMatchesForBareRegistryQuery(index, "security");
  assert.deepEqual(matches.map((item) => `${item.type}/${item.name}`), ["mode/security", "rule/no-secrets"]);

  const selected = await resolveRegistryItemForCommand(context, { index }, "security", {
    canPrompt: () => true,
    message: "Select an item to add",
    searchBareName: true,
    selectItem: async (message, items) => {
      assert.equal(message, "Select an item to add");
      assert.deepEqual(items.map((item) => `${item.type}/${item.name}`), ["mode/security", "rule/no-secrets"]);
      return items.find((item) => item.type === "rule");
    },
  });
  assert.equal(selected.name, "no-secrets");

  const nonInteractive = await resolveRegistryItemForCommand(context, { index }, "security", {
    canPrompt: () => false,
    searchBareName: true,
    selectItem: async () => {
      throw new Error("unexpected prompt");
    },
  });
  assert.equal(`${nonInteractive.type}/${nonInteractive.name}`, "mode/security");
});

test("interactive select handles ctrl-c as cancellation", async () => {
  const { selectChoice } = require("../src/prompt");
  const input = ttyStream();
  const output = ttyStream();
  const promise = selectChoice("Select an item", [{ name: "one", message: "one" }], { input, output });

  await new Promise((resolve) => setTimeout(resolve, 20));
  input.write("\x03");

  await assert.rejects(promise, /Selection cancelled/);
});

test("interactive select clamps arrow navigation at list ends", async () => {
  const { selectChoice } = require("../src/prompt");
  const input = ttyStream();
  const output = ttyStream();
  const choices = [
    { name: "one", message: "one" },
    { name: "two", message: "two" },
    { name: "three", message: "three" },
  ];
  const promise = selectChoice("Select an item", choices, { input, output });

  await new Promise((resolve) => setTimeout(resolve, 20));
  input.write(`${"\x1B[B".repeat(10)}\r`);

  assert.equal(await promise, "three");
});

test("interactive select still scrolls long lists before clamping", async () => {
  const { selectChoice } = require("../src/prompt");
  const input = ttyStream();
  const output = ttyStream();
  const choices = Array.from({ length: 12 }, (_, index) => ({
    name: `item-${index + 1}`,
    message: `item-${index + 1}`,
  }));
  const promise = selectChoice("Select an item", choices, { input, output, limit: 3 });

  await new Promise((resolve) => setTimeout(resolve, 20));
  input.write(`${"\x1B[B".repeat(20)}\r`);

  assert.equal(await promise, "item-12");
});

test("interactive registry suggestions group visible items by type", () => {
  const { groupChoicesByType, suggestGroupedChoices } = require("../src/prompt");
  const choices = [
    { itemType: "skill", name: "skill/frontend-design", message: "skill/frontend-design  Frontend guidance." },
    { itemType: "mode", name: "mode/security", message: "mode/security  Security review mode." },
    { itemType: "rule", name: "rule/no-secrets", message: "rule/no-secrets  Prevent credential leaks." },
  ];

  const grouped = groupChoicesByType(choices);
  assert.deepEqual(grouped.map((choice) => choice.message), [
    "Modes",
    "mode/security  Security review mode.",
    "Rules",
    "rule/no-secrets  Prevent credential leaks.",
    "Skills",
    "skill/frontend-design  Frontend guidance.",
  ]);
  assert.deepEqual(grouped.filter((choice) => choice.role === "heading").map((choice) => choice.message), [
    "Modes",
    "Rules",
    "Skills",
  ]);

  const filtered = suggestGroupedChoices("secrets", grouped);
  assert.deepEqual(filtered.map((choice) => choice.message), [
    "Rules",
    "rule/no-secrets  Prevent credential leaks.",
  ]);

  const polished = groupChoicesByType([
    {
      description: "Production OpenShift guidance.",
      idLabel: "skill/openshift-devops",
      itemType: "skill",
      name: "skill/openshift-devops",
      searchText: "skill/openshift-devops gitops pipelines ocp",
      version: "1.0.0",
    },
    {
      description: "Secure cluster changes.",
      idLabel: "rule/openshift-with-bob",
      itemType: "rule",
      name: "rule/openshift-with-bob",
      searchText: "rule/openshift-with-bob guardrails cluster",
      status: "deprecated",
    },
  ]);
  assert.doesNotMatch(polished.find((choice) => choice.name === "skill/openshift-devops").message, /v1\.0\.0/);
  assert.match(polished.find((choice) => choice.name === "skill/openshift-devops").message, /Production/);
  assert.match(polished.find((choice) => choice.name === "rule/openshift-with-bob").message, /deprecated\s+Secure/);
  assert.deepEqual(suggestGroupedChoices("ocp", polished).map((choice) => choice.name), [
    "__skill_heading",
    "skill/openshift-devops",
  ]);
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
  await writeTestGlobalConfig(cwd, [
    { name: "public", url: publicRegistryPath },
    { name: "team", url: teamRegistryPath },
  ]);
  await cli(cwd, ["init", "--yes"]);

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
  await cli(cwd, ["init", "--yes"]);
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
  await cli(cwd, ["init", "--yes"]);
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
  await cli(cwd, ["init", "--yes"]);
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
  await cli(cwd, ["init", "--yes"]);
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
    { cwd, env: testEnv(cwd) },
  );
  assert.match(search.stdout, /rule\/no-secrets/);
});

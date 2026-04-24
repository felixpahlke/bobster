# Bobster Planning Document

Date: 2026-04-24

## Summary

Bobster is an npm-distributed CLI and public GitHub registry for reusable Bob assets. Bob is IBM's coding agent, and Bobster gives teams a simple way to discover, install, update, and share the files that shape Bob's behavior.

The initial registry should support three entity types:

- Skills: agent skills installed into `.bob/skills/<name>/`
- Rules: reusable project or workflow rules installed into `.bob/rules/`
- Custom modes: Bob custom mode definitions merged into `.bob/custom_modes.yaml`

The CLI should keep a low operational footprint. The registry can live directly in the public GitHub repo, with contributors submitting new skills, rules, and modes through pull requests. The npm package provides the CLI; the registry content is fetched from GitHub raw URLs.

## Name And Package Strategy

Recommended public name:

- Product/repo: `bobster`
- npm package: `bobster`
- binary: `bobster`

Optional compatibility alias later:

- `bobr` as a binary alias if the team later publishes a scoped package such as `@ibm/bobr` or gets access to the deprecated unscoped `bobr` package.

Rationale:

- `bobster` is clear, professional, and broad enough for skills, rules, and custom modes.
- It avoids the awkward visual ambiguity of `bobz`.
- It is more flexible than `bobskills`, which sounds skill-only.
- It still keeps the Bob identity central.

## Product Goals

Bobster should make Bob customization feel as easy as installing a package:

```sh
bobster init
bobster search frontend
bobster add frontend-design
```

Primary goals:

- Make Bob assets discoverable.
- Make installation predictable and inspectable.
- Keep registry contribution simple through GitHub PRs.
- Support the current Bob folder conventions.
- Avoid requiring a hosted backend for v1.
- Keep file writes explicit, reversible, and conflict-aware.

Non-goals for v1:

- Hosted registry API.
- User accounts.
- Remote execution.
- Automatic background updates.
- Semantic search service.
- Complex dependency resolution between assets.

## Target Bob File Layout

Default install target:

```txt
.bob/
  skills/
    frontend-design/
      SKILL.md
      LICENSE.txt
  rules/
    react-quality.md
  custom_modes.yaml
```

Default assumptions:

- Skills live in `.bob/skills/<skill-name>/`
- Rules live in `.bob/rules/`
- Custom modes live in `.bob/custom_modes.yaml`

Bobster should also support custom paths because other agents and teams may use `.agents` or a mixed setup:

```json
{
  "target": ".bob",
  "paths": {
    "skills": ".bob/skills",
    "rules": ".bob/rules",
    "modes": ".bob/custom_modes.yaml"
  }
}
```

## Local Config

Bobster should create `bobster.json` during initialization.

Minimal default:

```json
{
  "$schema": "https://raw.githubusercontent.com/ORG/bobster/main/schema/bobster.schema.json",
  "target": ".bob",
  "registry": "https://raw.githubusercontent.com/ORG/bobster/main/registry/index.json"
}
```

Expanded example:

```json
{
  "$schema": "https://raw.githubusercontent.com/ORG/bobster/main/schema/bobster.schema.json",
  "target": ".bob",
  "registry": "https://raw.githubusercontent.com/ORG/bobster/main/registry/index.json",
  "paths": {
    "skills": ".bob/skills",
    "rules": ".bob/rules",
    "modes": ".bob/custom_modes.yaml"
  },
  "defaults": {
    "confirmWrites": true,
    "lockfile": true
  }
}
```

Config resolution:

1. CLI flags
2. `bobster.json`
3. defaults

Useful flags:

```sh
--target .bob
--registry <url>
--yes
--dry-run
--force
--json
```

## Lockfile

Bobster should create `bobster-lock.json` when assets are installed.

Example:

```json
{
  "lockfileVersion": 1,
  "registry": "https://raw.githubusercontent.com/ORG/bobster/main/registry/index.json",
  "items": [
    {
      "type": "skill",
      "name": "frontend-design",
      "version": "0.1.0",
      "source": "github:ORG/bobster/registry/skills/frontend-design",
      "commit": "abc123",
      "files": [
        ".bob/skills/frontend-design/SKILL.md",
        ".bob/skills/frontend-design/LICENSE.txt"
      ]
    }
  ]
}
```

The lockfile enables:

- `bobster list --installed`
- `bobster update`
- safer removal
- reproducibility
- auditing where installed content came from

## Registry Repository Layout

The same GitHub repo can contain both CLI source and registry content.

Recommended structure:

```txt
.
  package.json
  src/
    cli.ts
    commands/
    registry/
    installers/
    config/
  registry/
    skills/
      frontend-design/
        bobster.json
        SKILL.md
        LICENSE.txt
    rules/
      react-quality/
        bobster.json
        RULE.md
    modes/
      grug-brained/
        bobster.json
        mode.yaml
    index.json
  schema/
    bobster.schema.json
    registry-item.schema.json
  docs/
```

The generated `registry/index.json` should be committed to the repo. This keeps the CLI simple because it can fetch one file for discovery and exact resolution.

## Registry Item Manifest

Each item should include a `bobster.json` manifest.

Skill example:

```json
{
  "name": "frontend-design",
  "type": "skill",
  "version": "0.1.0",
  "description": "Create distinctive, production-grade frontend interfaces with high design quality.",
  "tags": ["frontend", "design", "ui"],
  "files": ["SKILL.md"],
  "entry": "SKILL.md"
}
```

Rule example:

```json
{
  "name": "react-quality",
  "type": "rule",
  "version": "0.1.0",
  "description": "Rules for building maintainable React interfaces.",
  "tags": ["react", "frontend", "quality"],
  "files": ["RULE.md"],
  "entry": "RULE.md"
}
```

Mode example:

```json
{
  "name": "grug-brained",
  "type": "mode",
  "version": "0.1.0",
  "description": "A direct, simple communication mode for Bob.",
  "tags": ["communication", "simple"],
  "files": ["mode.yaml"],
  "entry": "mode.yaml"
}
```

Manifest rules:

- `name` must be unique within its type.
- Names should be lowercase kebab-case.
- `type` must be one of `skill`, `rule`, or `mode`.
- `files` must not contain absolute paths.
- `files` must not contain `..`.
- `entry` must be included in `files`.
- A useful description is required because it powers search.

## Generated Registry Index

Example `registry/index.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-24T00:00:00.000Z",
  "baseUrl": "https://raw.githubusercontent.com/ORG/bobster/main/registry",
  "items": [
    {
      "name": "frontend-design",
      "type": "skill",
      "version": "0.1.0",
      "description": "Create distinctive, production-grade frontend interfaces with high design quality.",
      "license": "MIT",
      "tags": ["frontend", "design", "ui"],
      "path": "skills/frontend-design",
      "files": ["SKILL.md"],
      "entry": "SKILL.md"
    }
  ]
}
```

The CLI can resolve files by combining:

```txt
<baseUrl>/<item.path>/<file>
```

## Entity Install Semantics

### Skills

Install to:

```txt
<skills-path>/<name>/
```

Example:

```txt
.bob/skills/frontend-design/SKILL.md
.bob/skills/frontend-design/LICENSE.txt
```

Conflict policy:

- If the target directory does not exist, create it.
- If a file exists and content matches, treat as already installed.
- If a file exists and content differs, show a conflict and require `--force` or interactive confirmation.

### Rules

Install to:

```txt
<rules-path>/<name>.md
```

Registry rules can be stored as `RULE.md`, but installed under a stable project-facing name.

Example:

```txt
.bob/rules/react-quality.md
```

Conflict policy:

- Same as skills.
- Later support may allow rule bundles, but v1 should keep one rule item as one installed markdown file.

### Custom Modes

Registry stores a single mode object:

```yaml
slug: grug-brained
name: Grug Brained
description: Talk in grug style
roleDefinition: >-
  You are Bob. You think simple. You explain simple.
whenToUse: >-
  Use this mode when you want short, simple communication.
groups:
  - read
  - edit
  - command
customInstructions: >-
  ALWAYS talk to me in GRUG BRAINED fashion.
```

Bobster merges this into:

```yaml
customModes:
  - slug: grug-brained
    name: Grug Brained
    description: Talk in grug style
    roleDefinition: >-
      You are Bob. You think simple. You explain simple.
    whenToUse: >-
      Use this mode when you want short, simple communication.
    groups:
      - read
      - edit
      - command
    customInstructions: >-
      ALWAYS talk to me in GRUG BRAINED fashion.
```

Mode conflict policy:

- Match by `slug`.
- If no matching slug exists, append the mode.
- If matching slug exists and content matches, do nothing.
- If matching slug exists and content differs, require confirmation or `--force`.

## CLI Command Design

Recommended v1 command surface:

```sh
bobster init
bobster list
bobster search <query>
bobster info <name>
bobster add <name>
bobster remove <name>
bobster update [name]
```

Type-qualified names:

```sh
bobster add skill/frontend-design
bobster add rule/react-quality
bobster add mode/grug-brained
```

When a name is ambiguous across types:

```txt
Multiple items found for "frontend":

  skill/frontend
  rule/frontend

Use one of:
  bobster add skill/frontend
  bobster add rule/frontend
```

Useful aliases:

```sh
bobster learn <skill-name>   # alias for add skill/<skill-name>
bobster forget <name>        # alias for remove <name>
```

Recommendation:

- Document `add` as the canonical command.
- Keep `learn` as a fun skill-specific alias.

## Command Details

### `bobster init`

Creates:

```txt
bobster.json
.bob/
.bob/skills/
.bob/rules/
.bob/custom_modes.yaml
```

Default `custom_modes.yaml`:

```yaml
customModes: []
```

Options:

```sh
bobster init --target .bob
bobster init --target .agents
bobster init --registry <url>
bobster init --yes
```

Behavior:

- Detect existing `.bob` and `.agents` folders.
- Ask before overwriting `bobster.json`.
- Do not overwrite an existing `custom_modes.yaml`; parse and preserve it.

### `bobster list`

Lists registry items.

Examples:

```sh
bobster list
bobster list --type skill
bobster list --installed
bobster list --json
```

Default output:

```txt
Skills
  frontend-design      Create distinctive frontend interfaces

Rules
  react-quality        Maintainable React defaults

Modes
  grug-brained         Simple direct Bob communication mode
```

### `bobster search <query>`

Fuzzy search over:

- name
- description
- tags
- type

Examples:

```sh
bobster search frontend
bobster search "react ui"
bobster search frontend --type skill
```

For v1, use local fuzzy search through Fuse.js or a similarly small dependency. Avoid a semantic search backend until the registry has enough content to justify it.

### `bobster info <name>`

Shows metadata, install target, files, and source.

Example:

```txt
skill/frontend-design

Description:
  Create distinctive, production-grade frontend interfaces with high design quality.

Version:
  0.1.0

Files:
  SKILL.md
  LICENSE.txt

Install target:
  .bob/skills/frontend-design/
```

### `bobster add <name>`

Installs one registry item.

Examples:

```sh
bobster add frontend-design
bobster add skill/frontend-design
bobster add mode/grug-brained
bobster add frontend-design --dry-run
bobster add frontend-design --force
```

Default interactive behavior:

```txt
Install skill/frontend-design?

Files to create:
  .bob/skills/frontend-design/SKILL.md
  .bob/skills/frontend-design/LICENSE.txt

Proceed? [y/N]
```

With `--yes`, proceed without prompt unless there is a conflict. With `--force`, allow overwrites.

### `bobster remove <name>`

Removes installed item files tracked in `bobster-lock.json`.

Examples:

```sh
bobster remove frontend-design
bobster remove mode/grug-brained
```

Behavior:

- Only remove files that are lockfile-tracked.
- For custom modes, remove the matching `slug` from `custom_modes.yaml`.
- Leave parent directories if they contain non-Bobster files.
- Require confirmation unless `--yes`.

### `bobster update [name]`

Updates installed items using the configured registry.

Examples:

```sh
bobster update
bobster update frontend-design
bobster update --dry-run
```

Behavior:

- Read `bobster-lock.json`.
- Fetch current registry index.
- Compare versions and file hashes if available.
- Show planned changes.
- Apply with confirmation.

## Search Design

Start with fuzzy search, not semantic search.

Recommended searchable fields:

```txt
type
name
description
tags
```

Nice-to-have ranking:

1. Exact name match
2. Prefix name match
3. Tag match
4. Description match
5. Fuzzy fallback

Optional later:

- `registry/search-index.json` with precomputed keywords.
- `bobster search --semantic` using local embeddings or hosted search.
- GitHub Action that enriches item metadata.

## Validation

Validation should happen in two places:

1. In CI for registry contributions.
2. In the CLI before installation.

Registry CI should validate:

- Every item has `bobster.json`.
- Manifest matches schema.
- Item folder path matches type and name.
- Names are unique within a type.
- All declared files exist.
- No undeclared files except allowed metadata.
- Markdown/YAML files are parseable where applicable.
- Skill frontmatter includes `name` and `description`.
- Mode YAML has required Bob fields.
- Generated `registry/index.json` is current.

CLI install validation should check:

- Registry index schema.
- No path traversal in file paths.
- No absolute paths in file paths.
- Downloaded file count matches manifest.
- Optional integrity/hash if present.

## Security And Trust

Bobster installs instructions that influence agent behavior. Treat registry content as supply-chain material.

Security principles:

- Never execute registry content.
- Only copy files and merge YAML.
- Show planned writes before installing.
- Require confirmation for overwrites.
- Keep lockfile provenance.
- Validate paths aggressively.
- Support pinning by commit later.

Potential future hardening:

- File hashes in `index.json`.
- Signed registry releases.
- Trusted publisher provenance for npm.
- `bobster audit` to show installed assets and source commits.
- Maintainer review requirements for registry PRs.

## Implementation Stack

Recommended stack:

- TypeScript
- Node.js 20+
- `tsx` for development
- `tsup` or `unbuild` for packaging
- `commander` or `cac` for CLI routing
- `zod` for schema validation
- `yaml` for YAML parsing and stringifying
- `fuse.js` for search
- `picocolors` for terminal colors
- `prompts` or `@inquirer/prompts` for confirmations
- `vitest` for tests

Prefer small, boring dependencies. This CLI mostly fetches JSON, validates paths, copies files, and edits YAML.

## Proposed Source Architecture

```txt
src/
  cli.ts
  commands/
    init.ts
    list.ts
    search.ts
    info.ts
    add.ts
    remove.ts
    update.ts
  config/
    load-config.ts
    defaults.ts
  registry/
    fetch-index.ts
    resolve-item.ts
    search-items.ts
    schemas.ts
  installers/
    install-skill.ts
    install-rule.ts
    install-mode.ts
    planner.ts
  lockfile/
    read-lockfile.ts
    write-lockfile.ts
  fs/
    safe-path.ts
    write-plan.ts
    content-diff.ts
  validation/
    validate-registry.ts
    validate-item.ts
```

Key internal abstraction:

```ts
type WritePlan = {
  creates: PlannedWrite[];
  updates: PlannedWrite[];
  deletes: PlannedDelete[];
  conflicts: PlannedConflict[];
};
```

Every mutating command should first create a plan, then display or apply it. This makes `--dry-run`, conflict handling, and tests much easier.

## Testing Strategy

Unit tests:

- Config loading
- Registry item resolution
- Type-qualified names
- Search ranking
- Safe path handling
- Lockfile updates
- Mode YAML merging

Integration tests:

- `init` creates expected files.
- `add skill` writes skill directory.
- `add rule` writes rule markdown.
- `add mode` appends mode YAML.
- Reinstall is idempotent.
- Conflict detection works.
- `remove` removes only lockfile-owned files.
- `update --dry-run` reports changes without writing.

Fixture layout:

```txt
test/fixtures/
  registry/
    index.json
    skills/
    rules/
    modes/
  projects/
    empty/
    existing-bob/
    conflicting-files/
```

## GitHub Workflow

Recommended CI jobs:

- Typecheck CLI
- Run tests
- Validate registry
- Regenerate index and report when generated files changed
- Lint package metadata

Contributor flow:

1. Add item under `registry/<type>/<name>/`.
2. Add `bobster.json`.
3. Add content files.
4. Optionally run `npm run registry:prepare`.
5. Open PR with the item files.
6. Maintainers regenerate `registry/index.json` if the PR did not include it.
7. CI validates schemas and generated index.

## Registry Contribution Guidelines

Every registry item should include:

- Clear name
- Description optimized for discovery
- Tags
- Minimal files
- No secrets
- No project-specific private details

Quality requirements:

- Skills should have frontmatter with `name` and `description`.
- Rules should be narrow enough to be reused.
- Modes should clearly describe when to use the mode.
- All items should include a short README later if they need examples.

## Versioning

There are two kinds of versions:

- CLI version: npm package version.
- Registry item version: individual asset version.

For v1, item versions can be manually maintained in each manifest. Later, CI can enforce semver changes when files change.

Update behavior:

- Patch: wording, small improvements, typo fixes.
- Minor: meaningful new guidance or compatible behavior changes.
- Major: behavior-changing or potentially disruptive instructions.

## Roadmap

### Milestone 0: Skeleton

- Create package
- Set up TypeScript build
- Add CLI entrypoint
- Add basic `--help`
- Add test setup

### Milestone 1: Local Project Init

- Implement `bobster init`
- Write `bobster.json`
- Create `.bob` structure
- Preserve existing files
- Add tests

### Milestone 2: Registry Index

- Define registry schemas
- Add example skill, rule, and mode
- Generate `registry/index.json`
- Add validation command
- Add CI validation

### Milestone 3: Discovery

- Implement `bobster list`
- Implement `bobster search`
- Implement `bobster info`
- Add fuzzy search
- Add JSON output mode

### Milestone 4: Installation

- Implement write planner
- Implement skill installer
- Implement rule installer
- Implement mode installer
- Add conflict detection
- Add `--dry-run`, `--yes`, and `--force`
- Write lockfile

### Milestone 5: Removal And Updates

- Implement `remove`
- Implement `update`
- Make installs idempotent
- Add lockfile-based provenance

### Milestone 6: Public Release

- Finalize README
- Add contribution guide
- Add npm provenance publishing
- Publish `bobster`
- Add first curated registry items

## Initial Example Registry Items

Good first items:

- `skill/frontend-design`
- `skill/code-review`
- `skill/test-writer`
- `rule/no-secrets`
- `rule/typescript-quality`
- `mode/grug-brained`
- `mode/planner`

Keep the first set small and high quality. A registry with five useful assets is better than a registry with many vague ones.

## UX Principles

Bobster should feel:

- Direct
- Predictable
- Low ceremony
- Friendly but not unserious
- Safe around file writes

Good command examples:

```sh
bobster search react
bobster info frontend-design
bobster add frontend-design
bobster add mode/grug-brained
bobster update
```

Avoid requiring users to know the registry internals. Type-qualified names should exist for precision, not as the only happy path.

## Open Questions

- Should the npm package be unscoped `bobster` or scoped under an IBM-related namespace?
- Should registry content live in the same repo as the CLI or move to a separate `bobster-registry` repo later?
- Should rules be one markdown file per item, or can rule bundles contain multiple files?
- Should skills support dependencies on rules or modes?
- Should `learn` be documented as a primary command or only as an alias?
- Should the default init create `.bob/custom_modes.yaml` immediately or only when the first mode is installed?
- Should Bobster support Codex-compatible `.agents/skills` as a first-class target preset?

## Recommended Decisions For V1

- Use `bobster` as the public package and binary name.
- Keep registry content in the same GitHub repo for v1.
- Use GitHub raw URLs for registry fetches.
- Use `bobster.json` and `bobster-lock.json`.
- Support only `skill`, `rule`, and `mode`.
- Make `add` canonical.
- Add `learn` as a skill-specific alias.
- Use fuzzy search only.
- Treat every install as a planned file operation with dry-run support.
- Avoid a backend until the registry has real usage.

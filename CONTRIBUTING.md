# Contributing to Bobster

Bobster welcomes contributions to the CLI, documentation, and built-in registry of Bob skills, rules, and custom modes.

This project is community-maintained and independent. It is not an official IBM project, product, or distribution.

## Ways to Contribute

- Add a new skill, rule, or custom mode to the built-in registry.
- Improve an existing registry item.
- Fix CLI bugs or improve command behavior.
- Improve documentation, examples, tests, or schemas.
- Suggest registry ideas by opening an issue or draft pull request.

## Add a Registry Item

Registry items live under:

```txt
registry/
  skills/<name>/
  rules/<name>/
  modes/<name>/
```

Each item directory must contain a `bobster.json` manifest and the files listed in that manifest.

Use lowercase kebab-case names:

```txt
registry/skills/my-skill/
registry/rules/my-rule/
registry/modes/my-mode/
```

### Skills

Skills usually contain a `SKILL.md` file:

```txt
registry/skills/my-skill/
  bobster.json
  SKILL.md
```

Example manifest:

```json
{
  "name": "my-skill",
  "type": "skill",
  "version": "0.1.0",
  "description": "Help Bob do a specific reusable task.",
  "tags": ["example", "workflow"],
  "files": ["SKILL.md"],
  "entry": "SKILL.md"
}
```

### Rules

Single-file rules usually contain a `RULE.md` file:

```txt
registry/rules/my-rule/
  bobster.json
  RULE.md
```

Rules can also include supporting files:

```txt
registry/rules/my-rule/
  bobster.json
  RULE.md
  references/details.md
```

If a rule has multiple files or nested files, Bobster installs it as a directory under `.bob/rules/<name>/`. Single-file rules install as `.bob/rules/<name>.md`.

### Modes

Custom modes usually contain a `mode.yaml` file:

```txt
registry/modes/my-mode/
  bobster.json
  mode.yaml
```

The manifest should use `"type": "mode"` and `"entry": "mode.yaml"`.

## Registry Item Requirements

Before opening a PR, check that:

- The folder name matches `bobster.json` `name`.
- `name` is lowercase kebab-case.
- `type` is one of `skill`, `rule`, or `mode`.
- `description` clearly says what the item helps Bob do.
- `tags` are useful for search.
- Every path in `files` exists in the item folder.
- `entry` is included in `files`.
- `bobster.json` does not include a `license` field; registry content is covered by this repository's MIT license.
- Files do not include secrets, credentials, private URLs, or local machine details.
- Content is original, licensed for contribution under this repository's MIT license, or clearly allowed by its license.

Keep registry items focused. A good item should be reusable across projects, not tailored to one private codebase.

## Rebuild the Registry Index

`registry/index.json` is generated from the item manifests. If your PR adds, removes, renames, or edits a registry item manifest, rebuild the index and commit it with your change:

```sh
npm install
npm run registry:build
```

Then validate the generated index:

```sh
npm run registry:validate
```

Yes, contributors should normally include the updated `registry/index.json` in the PR. This keeps the published npm package and GitHub registry content in sync.

You do not need to rebuild the registry index for documentation-only changes or CLI source changes that do not touch registry manifests.

## Test Your Change

For registry-only changes, run:

```sh
npm run registry:validate
```

For CLI changes, run:

```sh
npm test
```

For package changes, also run:

```sh
npm run pub:check
```

## Try a Registry Item Locally

Use a scratch project so you do not accidentally write test assets into the Bobster repo:

```sh
npm run build
npm run registry:build

mkdir -p /tmp/bobster-test
cd /tmp/bobster-test

node /path/to/bobster/dist/src/cli.js init --registry /path/to/bobster/registry/index.json --yes
node /path/to/bobster/dist/src/cli.js add skill/my-skill --yes
node /path/to/bobster/dist/src/cli.js list --installed
```

Replace `skill/my-skill` with the item you are testing, such as `rule/my-rule` or `mode/my-mode`.

## Pull Request Checklist

Include a short PR description that explains:

- What item, command, or documentation changed.
- Why the change is useful.
- How you tested it.

For registry PRs, include:

- The new or updated item files.
- The updated `registry/index.json`, when a manifest changed.
- Any notes about source material or licensing, if relevant.

## External Repositories

For now, built-in registry items should include their installable files directly in this repository. Bobster can consume a different registry URL through `bobster.json`, but linking individual built-in registry items to files hosted in other repositories is future work.

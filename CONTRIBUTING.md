# Contributing to Bobster

Bobster welcomes contributions to the CLI, documentation, and built-in registry of Bob skills, rules, and custom modes.

This project is community-maintained and independent. It is not an official IBM project, product, or distribution.

## Ways to Contribute

- Add a new skill, rule, or custom mode to the built-in registry.
- Improve an existing registry item.
- Fix CLI bugs or improve command behavior.
- Improve documentation, examples, tests, or schemas.
- Suggest registry ideas by opening an issue or draft pull request.

If you are not comfortable running the project locally, open an issue with the skill, rule, or mode text you want to contribute. A maintainer can help turn it into a registry item.

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

## Optional: Prepare the Registry

For registry contributions, the important part is the item folder:

```txt
registry/<skills|rules|modes>/<name>/
```

Including an updated `registry/index.json` is helpful, but not required. If you only add or edit the item files, maintainers can regenerate the index before merging.

If you want to do the full local check, run:

```sh
npm install
npm run registry:prepare
```

That command rebuilds `registry/index.json` and validates it. You can also run the steps separately:

```sh
npm run registry:build
npm run registry:validate
```

You do not need to rebuild the registry index for documentation-only changes or CLI source changes that do not touch registry manifests.

## Test Your Change

For registry-only changes, run:

```sh
npm run registry:prepare
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
- The updated `registry/index.json`, if you ran `npm run registry:prepare`.
- Any notes about source material or licensing, if relevant.

## External Repositories

For now, built-in registry items should include their installable files directly in this repository. Bobster can consume a different registry URL through `bobster.json`, but linking individual built-in registry items to files hosted in other repositories is future work.

# Bobster

Bobster is an npm-distributed CLI and public registry for reusable Bob assets.

Bob is IBM's coding agent. Bobster helps teams discover, install, update, and share Bob skills, reusable rules, and custom modes without running a hosted registry service.

Bobster is an independent community project. It is not an official IBM project, product, or distribution.

## Install

Install the CLI globally:

```sh
npm install -g bobster-cli@latest
```

Install shell completions:

```sh
bobster completion install
```

## Quick Start

```sh
bobster search frontend
bobster info skill/frontend-design
bobster add skill/frontend-design
bobster list --installed
```

By default, Bobster installs into `.bob/`:

```txt
.bob/
  skills/
  rules/
  custom_modes.yaml
```

Installed assets are tracked in `bobster-lock.json` so they can be listed, removed, and updated later.

Use `bobster init` only when you want to write a `bobster.json` config, set a custom registry, or use a target folder other than `.bob/`.

## Commands

```sh
bobster init [--target .bob] [--registry <url>] [--yes] [--force]
bobster list [--type skill|rule|mode] [--installed] [--json]
bobster search <query> [--type skill|rule|mode] [--json]
bobster info <name> [--type skill|rule|mode] [--json]
bobster add <name> [--dry-run] [--yes] [--force] [--json]
bobster remove <name> [--dry-run] [--yes] [--json]
bobster update [name] [--dry-run] [--yes] [--json]
```

Every command supports focused help:

```sh
bobster add --help
bobster help update
```

Names can be type-qualified:

```sh
bobster add skill/frontend-design
bobster add rule/no-secrets
bobster add mode/grug-brained
```

Aliases:

```sh
bobster learn frontend-design
bobster forget skill/frontend-design
```

Single-file rules install as `.bob/rules/<name>.md`. Rule items with multiple files or nested paths install as `.bob/rules/<name>/...`.

## Shell Completion

Bobster ships shell completion scripts for commands, flags, `--type` values, registry item names, and installed item names. After installing the matching shell hook, `bobster add wats<Tab>` completes to `watsonx-orchestrate`.

Install completion for your current shell:

```sh
bobster completion install
```

You can also print a hook without installing it:

```sh
bobster completion zsh
```

## Config

`bobster.json` controls the target Bob folder and registry index:

```json
{
  "$schema": "https://raw.githubusercontent.com/felixpahlke/bobster/main/schema/bobster.schema.json",
  "target": ".bob",
  "registry": "https://raw.githubusercontent.com/felixpahlke/bobster/main/registry/index.json",
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

Use `--target .agents` if a project stores agent assets somewhere else.

## Develop Locally

For quick read-only checks while editing TypeScript source:

```sh
npm install
npm run dev -- --help
npm run dev -- search wxo
npm run dev -- add skill/watsonx-orchestrate --dry-run
```

`npm run dev` runs from the Bobster repo root, so do not use it for write tests unless you intentionally want files created in this repo.

For realistic local testing, link the CLI and use a scratch project:

```sh
npm run build
npm link

mkdir -p /tmp/bobster-test
cd /tmp/bobster-test

bobster init --yes
bobster search wxo
bobster add skill/watsonx-orchestrate --yes
bobster list --installed
```

After TypeScript changes, run `npm run build` again so the linked `bobster` binary uses the latest compiled code.

Before pushing, run:

```sh
npm test
npm run registry:validate
npm run pub:check
```

## Registry Maintenance

Registry items live in this repo:

```txt
registry/
  skills/<name>/
  rules/<name>/
  modes/<name>/
```

Each item has a `bobster.json` manifest plus declared content files. Maintainers can rebuild and validate the committed index with:

```sh
npm run registry:prepare
```

Run tests with:

```sh
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full registry contribution workflow and PR checklist.

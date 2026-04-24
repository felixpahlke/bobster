# Bobster

Bobster is an npm-distributed CLI and public registry for reusable Bob assets.

Bob is IBM's coding agent. Bobster helps teams discover, install, update, and share Bob skills, reusable rules, and custom modes without running a hosted registry service.

Bobster is an independent community project. It is not an official IBM project, product, or distribution.

## Install

```sh
npm install -g bobster
```

During local development in this repo:

```sh
npm install
npm run build
node dist/src/cli.js --help
```

## Quick Start

```sh
bobster init
bobster search frontend
bobster info skill/frontend-design
bobster add skill/frontend-design
bobster list --installed
```

`bobster init` creates:

```txt
bobster.json
.bob/
  skills/
  rules/
  custom_modes.yaml
```

Installed assets are tracked in `bobster-lock.json` so they can be listed, removed, and updated later.

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

## Registry Maintenance

Registry items live in this repo:

```txt
registry/
  skills/<name>/
  rules/<name>/
  modes/<name>/
```

Each item has a `bobster.json` manifest plus declared content files. Rebuild and validate the committed index with:

```sh
npm run registry:build
npm run registry:validate
```

Run tests with:

```sh
npm test
```

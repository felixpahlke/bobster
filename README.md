# Bobster

Bobster is an npm-distributed CLI and public registry for reusable Bob assets.

Bob is IBM's coding agent. Bobster helps teams discover, install, update, and share Bob skills, reusable rules, and custom modes without running a hosted registry service.

Bobster is an independent community project. It is not an official IBM project, product, or distribution.

## Install

Install the CLI globally:

```sh
npm install -g bobster-cli@latest
```

Install shell completions (TAB complete):

```sh
bobster completion install
```

## Quick Start

Use `bobster add` as the main path for discovery and installation. Type `bobster add <topic-you-need>` and you will get a list of suggested skills, rules, and custom modes that you can then directly add to your project.

```sh
# try
bobster add security
# or
bobster add frontend
```

If you already know the asset you want, inspect its metadata and preview its files before installing it by full registry ID:

```sh
bobster info skill/frontend-design
bobster show skill/frontend-design
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

Use `bobster init` only when you want to write a `bobster.json` config for a target folder other than `.bob/` or custom project paths.

## Commands

Run `bobster --help` for the first-level command overview:

```text
CORE COMMANDS
  search:             Search or browse the registry
  info:               Show item metadata and install targets
  show:               Print item file contents
  add:                Install or interactively pick an item
  remove:             Remove an installed item
  update:             Reinstall installed items from the registry
  list:               Browse registry topics or installed items

SETUP COMMANDS
  completion:         Install or print shell completions
  init:               Write bobster.json for custom paths

ALIASES
  learn:              Install a skill
  forget:             Remove an installed item

REGISTRY COMMANDS
  registry add:       Add a global public or private registry
  registry list:      List global registries
  registry doctor:    Check global registry access and schema
  registry build:     Rebuild registry/index.json
  registry validate:  Validate registry manifests and files
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

`bobster add` accepts normal words and is the primary discovery path. Use `bobster add security` to search by topic or phrase, then pick a matching asset in an interactive terminal. Use `bobster list` for a small catalog, `bobster list security` to narrow by topic, or `bobster search appsec` when you only want search results without installing.

Registry items use a few discovery fields:

- `topics`: small browse buckets shown by `bobster list`, such as `security`, `frontend`, `devops`, `industry`, or `aerospace`.
- `tags`: flexible descriptive labels.
- `aliases`: alternate phrases people might type.
- `keywords`: extra search terms that do not need to be displayed.
- `status`: `stable`, `experimental`, or `deprecated`.

Topics are not hard-coded in the CLI. Bobster builds the catalog from the topics present in the configured registry or registries.

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

`bobster.json` controls only project-local install paths and defaults:

```json
{
  "$schema": "https://raw.githubusercontent.com/felixpahlke/bobster/main/schema/bobster.schema.json",
  "target": ".bob",
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

Registry sources are global to the user and apply anywhere Bobster runs. By default Bobster uses the public registry. `bobster registry add` writes the global config at `~/.config/bobster/config.json`, or the path in `BOBSTER_CONFIG` when set.

Add private or team registries with:

```sh
bobster registry add internal https://github.example.com/team/bobster-registry/blob/main/registry/index.json
bobster registry add ssh/git@github.ibm.com:team/bobster-registry-internal.git
bobster registry doctor internal
bobster add internal/rule/example-rule
```

For private GitHub or GitHub Enterprise HTTPS registries, Bobster derives the host from the URL and uses the local GitHub CLI login when authentication is needed. Run `gh auth login -h <host>` if `registry doctor` reports an authentication error.

SSH Git registry shorthands stay SSH-backed and use the user's configured Git SSH key or agent. Bobster keeps a global partial Git cache under `~/.cache/bobster/git-registries/`, fetches the current remote `HEAD` before reading the registry, and reads only `registry/index.json` plus selected item files from that commit. No registry checkout is created in the project. For repositories named `bobster-registry-<name>`, Bobster infers `<name>` as the registry name.

## Private Registries

Private registries use the same layout as the public registry:

```txt
registry/
  index.json
  skills/<name>/
    bobster.json
    SKILL.md
  rules/<name>/
    bobster.json
    RULE.md
  modes/<name>/
    bobster.json
    mode.yaml
```

Each item manifest lists the files that belong to the item:

```json
{
  "name": "example-rule",
  "type": "rule",
  "version": "0.1.0",
  "description": "Example project guidance for Bob.",
  "tags": ["example"],
  "topics": ["security"],
  "aliases": ["appsec", "secure coding"],
  "keywords": ["credentials", "tokens", "private keys"],
  "status": "stable",
  "files": ["RULE.md"],
  "entry": "RULE.md",
  "origin": {
    "url": "https://github.example.com/team/source-repo/blob/main/path/to/original.md",
    "path": "path/to/original.md",
    "ref": "main"
  }
}
```

`origin` is optional. Use it for private or migrated assets when maintainers need to know where an item originally came from. Remove or replace private origin metadata before promoting content into a public registry.

Do not commit private registry clones or private registry URLs to this public repository.

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

# Bobster

Bobster is an npm-distributed CLI and public registry for reusable Bob assets. Bob is IBM's coding agent; Bobster helps teams discover, install, update, remove, and share Bob skills, reusable rules, and custom modes without needing a hosted registry service.

This project is for teams that want Bob customization to be portable, inspectable, and easy to manage across projects. It installs assets into a target agent folder such as `.bob/`, tracks installed content in `bobster-lock.json`, and keeps the registry content in this repository so contributions can happen through normal GitHub pull requests.

The repository contains:

- `src/`: TypeScript CLI implementation for `bobster init`, `list`, `search`, `info`, `add`, `remove`, `update`, and registry maintenance commands.
- `registry/`: Versioned skills, rules, modes, and the generated `registry/index.json`.
- `schema/`: JSON schemas for Bobster config and registry item manifests.
- `test/`: Node test coverage for CLI behavior.
- `.private-registries/`: Optional ignored workspace for local clones of private Bobster-compatible registries. Agents may use this folder to maintain private registry content alongside the public CLI repo, but must not commit files from it or mention private registry URLs in public docs.

Bobster is an independent community project. It is not an official IBM project, product, or distribution.

## Extra Info

It is possible that multiple agents will be working on this project in parallel - if you notice changes on files that you also touched, do not revert other functionality that has been added by someone else.

Use concise Conventional Commit messages, such as `feat(scope): headline` or `refactor(scope): headline`. Add short bullet lines below only when a commit contains multiple separate changes.

Do not commit by yourself, only if specifically asked to do so.

When editing registry manifests, keep discovery metadata disciplined: `topics` are small human browse buckets, `tags` are flexible labels, `aliases` are phrases users might type, and `keywords` are hidden search helpers. Do not turn `topics` into a duplicate tag list; prefer 1-3 topics and follow the guidance in `CONTRIBUTING.md`.

## Project State

Please keep a concise Log of recent changes you made in ./PROJECT_STATE.md. You can also list Roadmap / Todos here. Treat it as a scratchpad, but keep all entries short and concise and only add usefull information for other Agents / Developers.

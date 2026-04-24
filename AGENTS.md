# Bobster

Bobster is an npm-distributed CLI and public registry for reusable Bob assets. Bob is IBM's coding agent; Bobster helps teams discover, install, update, remove, and share Bob skills, reusable rules, and custom modes without needing a hosted registry service.

This project is for teams that want Bob customization to be portable, inspectable, and easy to manage across projects. It installs assets into a target agent folder such as `.bob/`, tracks installed content in `bobster-lock.json`, and keeps the registry content in this repository so contributions can happen through normal GitHub pull requests.

The repository contains:

- `src/`: TypeScript CLI implementation for `bobster init`, `list`, `search`, `info`, `add`, `remove`, `update`, and registry maintenance commands.
- `registry/`: Versioned skills, rules, modes, and the generated `registry/index.json`.
- `schema/`: JSON schemas for Bobster config and registry item manifests.
- `test/`: Node test coverage for CLI behavior.

Bobster is an independent community project. It is not an official IBM project, product, or distribution.

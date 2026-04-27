# Project State

- Private registries may live under `.private-registries/`; this path is ignored and can contain private clones for local agent maintenance.
- Imported Bob `Modes/` into `.private-registries/bobster-registry-internal` as private mode registry items with `origin` metadata.
- Promotion path: review private imported content item by item before copying to public `registry/`; strip or replace private `origin` metadata before public release.
- Discovery metadata is supported via `topics`, `aliases`, `keywords`, and `status`; public and private registry indexes have been regenerated with those fields.
- `bobster list` now shows a catalog overview, `bobster list <topic>` narrows results, and `bobster add` opens a searchable picker in interactive terminals.
- `bobster list` now opens an interactive topic picker in TTYs, wraps rows by terminal width, and GitHub repo/tree registry URLs resolve through the contents API.
- Public watsonx Orchestrate ADK skills were imported as public registry skills where public-safe; `wxo-builder` was consolidated into `watsonx-orchestrate/references/` instead of creating a duplicate wxO skill.
- Internal skills should remain in `.private-registries/bobster-registry-internal` unless reviewed for public promotion.

# Maintainability Refactor Plan

## Goals

- Keep CLI behavior stable while making core flows easier to change.
- Make registry sources, write plans, and command contexts explicit instead of loosely typed `any` data.
- Reduce duplicated command orchestration around planning, applying, and lockfile updates.

## Refactor Tracks

1. Add shared domain types for registry items, registry contexts, lockfile entries, write plans, command contexts, and IO.
2. Split registry loading into source adapters:
   - local file sources
   - HTTP sources
   - GitHub URL normalization and auth
   - SSH Git registry cache
   - multi-registry aggregation
3. Strengthen write-plan APIs so commands ask for summaries and apply behavior instead of manually reading internal buckets.
4. Extract install/update orchestration so command modules mostly handle argument resolution and output wording.
5. Split completion support into shell installation and suggestion generation modules.
6. Split the large CLI test file into focused command/domain suites with shared fixtures.

## Starting Slice

- Centralize write-plan path summary generation.
- Replace duplicate plan JSON mapping in `init`, `add`, `remove`, and `update`.
- Preserve current JSON output shapes for existing commands.

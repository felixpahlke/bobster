# TypeScript Quality

For TypeScript changes:

- Prefer existing local patterns over new abstractions.
- Keep public types explicit at module boundaries.
- Avoid `any` unless it is already the established escape hatch or the boundary is genuinely dynamic.
- Make invalid states hard to represent when the surrounding code supports it.
- Run the nearest typecheck and focused tests after changing shared behavior.

When a type assertion is required, keep it narrow and explain the runtime fact that makes it safe.

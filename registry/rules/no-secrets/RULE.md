# No Secrets

Do not commit credentials, tokens, private keys, cookies, production URLs with embedded credentials, or user-specific local paths.

Before creating or updating files:

- Check examples, fixtures, and generated files for accidental secrets.
- Use placeholder values such as `example-token` or `replace-me`.
- Prefer environment variables for local credentials.
- Keep `.env` files out of version control unless they are explicitly sample files with fake values.

If a secret appears in a diff, stop and remove it before continuing. If it may already have been committed or shared, tell the user that rotation is required.

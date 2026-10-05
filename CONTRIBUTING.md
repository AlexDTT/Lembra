# Contributing

Lembra is a Portuguese-first organizer designed for private, invite-only deployments. Each deployment needs its own Supabase and Google configuration; contributing does not grant access to anyone else's data.

Use Node 22.12 or newer and pnpm 10.33.2. Run `pnpm install --frozen-lockfile`, then follow the [setup guide](README.md#13-setup-guide) to run your own app. Unit and browser tests use synthetic data and need no production credentials.

Before opening a pull request, run:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests start their own server on port 5174 and override frontend configuration with a fictional, mocked Supabase backend. Keep that port available. They do not verify real Google sign-in or push delivery.

Keep pt-PT and English copy together, retain accessible controls, and include database migrations for schema changes. Explain the problem, resulting behavior and checks in your pull request. Use synthetic examples; never include account tokens, health records, database exports or production screenshots.

Report vulnerabilities through the process in [SECURITY.md](SECURITY.md).

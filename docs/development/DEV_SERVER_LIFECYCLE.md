# Supervised local development

`pnpm dev` supervises four loopback-only services with `concurrently --kill-others`.
Each child must stay in the foreground. Astro 7 detects coding-agent environments
and otherwise auto-backgrounds `astro dev`, exiting successfully and causing the
supervisor to stop the other services. This is a local orchestration bug, not an
API readiness failure.

The public application's dev and preview scripts use Astro's supported `--ignore-lock` option
to select its foreground path even under agent detection. It does not use
`--force`, stop an existing process, or change production/build behavior. Because
this mode bypasses Astro's dev lock registry, stop the supervising `pnpm dev`
process with Ctrl-C (Playwright owns preview cleanup); do not use `astro dev stop`
or `astro preview stop`. Do not start duplicate services
on occupied ports.

`pnpm test:e2e` runs the existing preview/Worker journeys first, then an isolated
development-server campaign in `playwright.dev.config.ts`. The latter forces
agent detection, launches the actual `pnpm dev` command, checks both frontends
and both real local Workers, and tears down its owned process group. Existing
servers are not reused. Readiness remains 503 until genuine dependencies exist;
this test does not establish business-feature, provider or cloud readiness.

# CrashLine

Synthetic motor-accident intake with browser voice, two specialist agents, and plan-bound MCP execution protected by ArmorIQ.

This is a prototype for collecting facts and preparing a preliminary report for human review. It does not determine fault, guarantee coverage, change policies, approve settlements, or make payments.

## Stack and project conventions

- Bun 1.4.2 workspaces and Turborepo.
- Express HTTP servers with routers and services; no controller layer.
- PostgreSQL 17 and Prisma 6.19.
- React/Vite dashboard, browser EventSource updates, and hosted ElevenLabs voice.
- Gemini 3.5 Flash through a configurable OpenAI-compatible endpoint; the supplied environment uses AIRouter.
- Genuine TypeScript MCP server and `@armoriq/sdk` 0.6.10.
- Every authored function must remain at or below 100 lines. Run `bun run check:functions`.

## Hosted demo

Open [crashline.manv.blog](https://crashline.manv.blog) and enter the privately
provided demo access token in Connection settings. The app runs on EC2 with
Neon PostgreSQL and the ArmorIQ registration `insurance-mcp-cloud` at
`https://crashline-mcp.manv.blog/mcp`.

The hosted synthetic workflow passed draft replay, correction, current-version
confirmation, both specialist reviews, all seven allowed tools, and HTTPS
event streaming. A separate real remote-policy test blocked settlement approval
with zero handler executions. See [hosted execution evidence](docs/hosted-live-evidence.json),
[policy denial evidence](docs/live-policy-block-evidence.json), and
[cloud deployment](docs/cloud-deployment.md). A real spoken call and submission
recording still need to be completed.

## Local setup

Install Bun and Docker Desktop, then run from this directory:

```powershell
bun install --frozen-lockfile
bun run env:setup
docker compose up -d db
bun run db:generate
bun run db:deploy
bun run db:seed
```

`env:setup` creates `.env` from `.env.example` if necessary and fills empty local access tokens. It preserves existing values and does not print them. Add provider keys to `.env` locally. Never commit that file.

Set `ARMORIQ_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `MODEL_API_KEY`, `MODEL_BASE_URL`, and `MODEL_NAME`. For AIRouter use `MODEL_BASE_URL=https://api.airouter.in/v1` and `MODEL_NAME=google/gemini-3.5-flash`. Provider keys stay server-side.

The database binds only to loopback port 5433. Its named Docker volume persists when the container is stopped. Do not use `docker compose down -v` unless you intentionally want to remove that data.

## Start and stop

After generating the Prisma client and completing database setup:

```powershell
bun run dev
```

Services bind to loopback: dashboard 5173, API 4000, orchestrator 4001, and MCP 4002. The voice-agent package stores hosted configuration and does not run an audio server. Stop the foreground command with Ctrl+C and use `docker compose stop db` to stop PostgreSQL without removing data.

Individual services can be started with `bun run dev --filter=@crashline/api` or equivalent Turbo filters. If the root script does not forward a filter in your Bun version, use `bun x turbo run dev --filter=@crashline/api`.

On Windows, stop running Prisma consumers before regenerating the client after a schema change; the native query-engine DLL may otherwise be locked. The normal build does not regenerate it.

## Demo authentication

There is one synthetic account, DEMO-001 / Alex Morgan, and one connected policy, POL-1001. Ownership is resolved by the server. Saying a different identity or policy number cannot change that binding.

The local Vite development proxy supplies the configured demo operator token to the API on behalf of the local workspace. The hosted demo prompts for that token in Connection settings; it is not baked into the frontend bundle. This prototype uses a shared synthetic workspace; production identity would require separate operator accounts.

ElevenLabs tools require both their configured provider bearer secret and a short-lived session capability. The capability is scoped to the synthetic account/policy, visible to that user's browser, and passed to ElevenLabs as a secret dynamic variable. It is not the provider API key or an internal service credential.

## Live ArmorIQ connection

The custom `insurance-mcp` implements the policy and claims tools. ArmorIQ supplies plan signing, a registry, and enforced proxy invocation; it must be able to reach the secured MCP transport.

1. Start PostgreSQL and the MCP service. For a local demo, expose only the authenticated MCP endpoint through an HTTPS tunnel. Do not expose PostgreSQL or the orchestrator.
2. Set `INSURANCE_MCP_ENDPOINT` to that HTTPS `/mcp` URL. Set `ARMORIQ_MCP_NAME` to the registered server name, normally `insurance-mcp`.
3. Review `apps/orchestrator/scripts/register-mcp.ts`. Registration sends that URL, the MCP bearer token, and a narrow allow/deny tool policy to ArmorIQ. Run `bun run armoriq:register` only after the intended external account changes and credential sharing are authorized.
4. Registration saves the returned `ARMORIQ_AGENT_ID` in `.env`. Run `bun run armoriq:check` to inspect the actual signed policy. ArmorIQ's registration endpoint truncates dotted tool names, so the genuine MCP also exposes transport aliases such as `claims__create_draft`. The signed plan, proxy invocation, and restricted registered policy use these aliases; the handler still verifies the canonical domain name and permissions, and audit records retain names such as `claims.create_draft`. Only the seven safe aliases are allowed. Settlement approval and coverage changes remain denied. Check again after updating a tunnel URL.
5. Run `bun run security:live` with no background investigation worker competing for its run. The harness uses the same gateway and domain implementation as the app. Do not treat local tests as live evidence.
6. Run `bun run security:policy-live` for a distinct remote-policy proof. This diagnostic deliberately declares the forbidden settlement tool in a synthetic plan, so an SDK-only out-of-plan rejection cannot satisfy it. It requires `ARMORIQ_POLICY`, zero handler invocations, and no execution before writing evidence.

Temporary tunnel URLs change when restarted. Update `.env`, repeat authorized registration/configuration, and verify reachability before a demo. A stopped tunnel URL is not a persistent deployment.

There is no direct-MCP fallback when ArmorIQ is unavailable. Typed intake also uses enforced tools and therefore requires a working ArmorIQ integration to save a claim.

The MCP HTTP boundary removes only ArmorIQ's extra top-level `_iam_context` before passing the request to the real SDK's strict JSON-RPC parser. That metadata never grants authority: every domain handler still requires the signed `_authorization` context. Loopback reverse proxies are trusted for client-IP accounting; the services continue to bind to localhost.

## ElevenLabs configuration

The selected existing agent ID is stored locally in `.env` and the ignored configuration state. Inspect the prompt and tool definitions in `apps/voice-agent/` first.

```powershell
bun run voice:preview
```

Set `PUBLIC_API_URL` to the secured HTTPS API URL. Once the hosted account changes are authorized, run `bun run voice:configure`. The script creates/reuses a workspace sender secret, creates/reuses three tools, updates the selected agent, and enables signed-URL access. It stores resource IDs locally to avoid duplicating them on retries.

The optional post-call route verifies ElevenLabs HMAC signatures. Post-call webhook delivery still needs to be enabled in the provider workspace, and `ELEVENLABS_POSTCALL_WEBHOOK_SECRET` must match the secret issued there. It is not required to create live drafts. No audio archive is implemented.

## Checks

```powershell
bun run typecheck
bun run build
bun run test
bun run check:functions
# With the local synthetic database running:
$env:RUN_DB_TESTS='true'
bun test tests --timeout 30000
Remove-Item Env:RUN_DB_TESTS
```

The database suites create their own synthetic fixtures and remove their records afterward. Test transport doubles are explicitly labeled and must never be presented as live ArmorIQ evidence.

## Documentation and policy examples

- `docs/architecture.md`: service boundaries, jobs, and authorization.
- `docs/armoriq-evidence.md`: what counts as evidence and how to interpret decisions.
- `docs/demo-script.md`: rehearsal and recording sequence.
- `docs/policies/README.md`: the fictional policy documents and their availability.

The PDFs are reference documents, not an implemented document-ingestion pipeline. POL-1001 matches the original seed. POL-1002 and POL-1003 are document-only examples and are not selectable in the current authenticated intake flow.

## Reuse disclosure and current limits

CrashLine was authored with AI coding assistance in this workspace. The existing sibling AI-interview application was preserved and its source was not imported into CrashLine. Standard open-source runtime/framework dependencies are recorded in `bun.lock`.

Seeded records are explicitly marked as demo. No successful enforcement attempts, model findings, or reports are preseeded. Agent authority currently uses independently restricted signed plans; cryptographic delegated child tokens are not implemented or claimed. Production claims processing, real customer data, payouts, images, and telephone/PSTN infrastructure are excluded.

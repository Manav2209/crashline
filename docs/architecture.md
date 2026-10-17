# CrashLine architecture

## Runtime boundaries

`apps/web` renders the claims workspace and connects browser audio to the hosted ElevenLabs agent. It never receives provider API keys, signs execution plans, accesses PostgreSQL, or invokes MCP directly.

`apps/api` is the public Express gateway. Routers validate requests and call services for demo identity, sessions, queries, confirmations, voice webhooks, and SSE. The provider bearer secret and session capability are both required for voice tool proposals. Raw post-call bodies are HMAC-verified before parsing.

`apps/orchestrator` is a separate internal Express process. Its service token is distinct from voice credentials. It owns trusted task intent, independent scoped plans, the tool gateway, durable investigation jobs, specialist calls, and deterministic report assembly. Agent instructions cannot assign themselves a role or a different policy.

`apps/insurance-mcp` registers genuine MCP tools using the TypeScript MCP SDK and a stateless Streamable HTTP transport. It validates its bearer token, signed request context, argument digest, ownership, role, workflow stage, and investigation lease. Successful operations have durable idempotency receipts. Forbidden settlement and policy-change operations have no domain mutation implementation.

`apps/voice-agent` is versioned hosted-agent configuration, not another running backend or STT/TTS service.

## Tool execution

Trusted session -> trusted workflow intent -> ArmorIQ signed plan -> SDK/proxy invocation -> authenticated MCP handler -> domain transaction and receipt -> persisted ToolAttempt -> dashboard.

All agent-initiated insurance operations go through `services/gateway.ts`. Application code does not dispatch directly to MCP if enforcement fails. The MCP server applies domain defenses in addition to ArmorIQ.

The SDK may reject an action locally when it is outside a signed plan. A policy service may also reject a request. These sources are stored separately; neither is replaced with a model's verbal refusal.

## Claim workflow

Draft -> explicit confirmation of the current version -> submitted and investigation queued -> investigating -> pending human review, or investigation failed/partial review.

Draft updates clear the earlier confirmation. A duplicate operation key must identify the same tool, arguments, session, role, and run; it cannot be repurposed for another mutation. Submission and job enqueue happen in the same domain transaction.

## Investigations and recovery

The worker atomically claims a queued PostgreSQL run, increments its attempt, and leases it for 120 seconds. It renews the lease while working. Recovered workers must use the current lease owner and attempt; a stale worker cannot write findings or save a report after reassignment.

Policy Agent and Claims Investigator run independently with separate prompts, tools, and output schemas. Each has a bounded model/tool loop and a timeout. Model response identifiers and token counts are stored as activity events without raw credentials. Findings are saved separately, so a completed section survives failure of another section.

The report merger is deterministic code. Missing or invalid specialist output produces a marked partial report and human-review requirement. Report persistence also uses guarded MCP. If persistence cannot be verified, the run is not silently declared successful.

## UI and transport

Claims queries support search, status filtering, and pagination. Security queries expose recorded decisions, their source, handler invocation, result status, receipts, and provider-returned plan/trace references.

Native EventSource uses a short-lived, one-use stream ticket obtained from an authenticated route. The long-lived operator credential is not put into the SSE query string. The client reconnects with a fresh ticket if its stream closes.

## Scope limits

One synthetic account and policy are connected today. The additional policy PDFs are not ingested automatically. Access tokens and local dev authentication are for a sandbox demonstration. Independent signed plans are implemented; cryptographic delegation is optional future work and must not be claimed without a live proof.

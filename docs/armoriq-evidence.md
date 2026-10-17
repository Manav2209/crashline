# ArmorIQ evidence guide

## Acceptable proof

An allowed action must use the real configured ArmorIQ SDK/proxy and produce the expected real sandbox read or mutation. CrashLine requires a matching persisted MCP execution receipt before returning successful data.

A blocked action must produce an actual ArmorIQ rejection and must not invoke the target MCP handler or mutate policy/settlement data. Do not count a hardcoded UI label, local role check, model refusal, mocked adapter, or transport error as that proof.

Capture the actual attempt source. `ARMORIQ_SDK_PLAN` means the installed SDK rejected the proposed action against the signed plan. `ARMORIQ_POLICY` means a policy rejection was returned through the SDK. `ARMORIQ_PROXY` marks a verified proxy response. Never describe an SDK-only rejection as a remote policy decision.

## Audit fields

- `decision`: ALLOW, BLOCK, HOLD, or UNAVAILABLE.
- `enforcementSource`: the mechanism that produced the recorded decision.
- `mcpInvoked`: whether the target handler has an invocation record for that operation.
- `executed`: whether a matching successful execution receipt exists.
- `resultStatus`: whether an authorized domain operation succeeded, failed, or was not executed.
- `planHash` and `armorPlanId`: references returned in the actual signed token, when present.
- `armorTraceId`: a trace identifier returned by the provider, when supplied. Leave it absent otherwise.
- Correlation ID, operation ID, role, tool, claim/run/session linkage, and timestamps.

ALLOW with result ERROR means authorization passed but domain validation/execution did not complete. It is not a saved claim. UNAVAILABLE means the enforcement or its outcome could not be verified; the application never retries by bypassing ArmorIQ. HOLD is not an automatic approval.

## Rehearsal proof

1. Create a synthetic draft through the actual gateway and verify its database row and matching receipt.
2. Repeat the exact operation with the same idempotency key; verify no extra row or version increment.
3. Attempt settlement approval as the investigator and a coverage change as the policy role. Verify BLOCK, the actual decision source, zero target-handler invocations, and unchanged policy data.
4. Attempt a cross-scope claim read as the policy role and verify that it is rejected.
5. Exercise an enforcement outage separately and show UNAVAILABLE, not an invented block.
6. Complete both real specialist model calls and inspect the persisted findings/report.

Keep an export or screenshot from ArmorIQ itself with matching plan/trace references. A local JSON export is useful supporting evidence but is not a substitute for provider-side proof. Never label a locally computed hash as an ArmorIQ proof.

## Voice attack honesty

The normal hosted voice configuration has three intake tools and does not enable settlement approval. A malicious caller may be refused before any tool proposal is emitted. Show that refusal accurately, then show a separate, clearly labeled harness attempt through real enforcement.

Enabling the optional sandbox attack route requires `DEMO_ATTACK_ENABLED=true` and appropriate webhook configuration. It still has no settlement implementation. Never enable it for real customer operations.

## Current evidence state

No live allow/block proof is bundled by default. `security:live` writes `docs/live-security-evidence.json` only after actual checks pass. Unit and database tests use clearly labeled test inputs/doubles and clean up their evidence rows. Do not present those test outcomes as provider-side enforcement proof.

`security:policy-live` separately writes `docs/live-policy-block-evidence.json` only after a real remote policy rejection of a forbidden action explicitly declared in the diagnostic plan, with no matching handler invocation or execution. This distinguishes remote policy enforcement from the SDK's earlier out-of-plan rejection.

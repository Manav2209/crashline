# Submission and 4–5 minute recording script

Deadline supplied by the organizer: **17 October 2026, 11:59 PM IST**.
Keep the submitted live URL working **17–21 October 2026**.

## Before recording

Activate ArmorTools Pro at https://tools.armoriq.ai with code `FLOWSTATEPRO`;
verify the first 12 months are free and the account shows active Pro. This is
required for every member; this submission is solo. The owner reports Pro is
activated; its console status has not been independently verified. Also verify that the actual SDK rules are represented and applied
in ArmorTools Policy Studio; this connection is not yet verified.

Use only fictional accident facts. Keep credentials, private access tokens,
signed conversation URLs, and account billing details outside the recording.
Record after the stable cloud URL passes the acceptance checks in
`docs/cloud-deployment.md`. The replacement `insurance-mcp-cloud` registration
passed a hosted policy lookup and a remote settlement policy denial on
17 October. Use that entry when showing current evidence; the old entry still
points to an expired tunnel and is no longer used by the hosted app.

## Recording sequence

**0:00–0:25 — Problem and audience.**
"After an accident, repeating facts across a call and a claim form adds stress.
CrashLine helps a claims intake team collect a consistent accident report by
voice, investigate it with specialists, and keep consequential actions under
explicit permissions. This demo uses fictional policies and claim data."

**0:25–0:50 — What is connected.**
Show the hosted intake page and active connections. "ElevenLabs handles the
conversation. Express services store the claim in PostgreSQL. Specialist model
calls use Gemini through AIRouter. ArmorIQ authorizes scoped tool plans and
proxies insurance MCP calls; local checks also bind each call to its owner,
session, and claim."

**0:50–2:40 — Real call, end to end.**
Start a fresh voice session and say:

"No one is injured or in immediate danger. I'm Alex Morgan on policy POL-1001.
On October 15, 2026 at 9:30 AM India time, I was stopped at a traffic signal on
Main Street in Demo City and another car hit the rear of my car. Another driver
was involved. I don't know whether a police report was filed."

When the agent has collected the draft: "Correction: it was 10:30 AM, on Oak
Street. Please read the updated details back. Don't submit yet."

After the corrected readback: "Can I claim the repair cost?" The agent should
describe relevant terms without guaranteeing coverage or a payout.

Then: "I confirm these corrected details. Submit the accident report."
Show the stored claim, tool activity, specialist results, and report awaiting
human review. Record only an actual completed run; keep any wait visible or
label a cut clearly.

**2:40–3:45 — ArmorTools console and rules.**
Show https://tools.armoriq.ai, the actual Policy Studio rules, and their real
allow/block evidence for this MCP. Seven domain tools are allowed and two
consequential diagnostic actions are denied. The MCP transport aliases use
double underscores, such as `policy__get_details` and
`claims__approve_settlement`; the app displays their dotted domain names.

Demonstrate a fresh denied settlement attempt using the diagnostic that declares
the forbidden action in its plan. Show remote `ARMORIQ_POLICY` / `BLOCK`,
`executed: false`, and zero handler invocations. Explain: "A conversational
refusal is not our enforcement proof. ArmorIQ blocked this tool request before
the insurance handler ran. Settlement and coverage mutation are intentionally
unimplemented diagnostic targets in this sandbox."

Do not label an SDK plan exclusion as a remote Policy Studio block. If the Pro
console cannot show or apply these rules, resolve that before claiming this
part of the submission is complete.

**3:45–4:25 — Takeaways and next steps.**
"We learned to separate what an agent says from what it is authorized to do.
Scoped plans, confirmation of the current draft, and persisted execution
receipts make the workflow easier to inspect. This prototype submits an
accident report for human review; it does not approve settlements or issue
money. Next we would add insurer integrations, production identity, richer
policy documents, and cryptographic delegation between specialists."

## Submission text to adapt after verification

**Repository:** https://github.com/Manav2209/crashline

**Live demo:** https://crashline.manv.blog is deployed with working public HTTPS,
Neon, signed voice session creation, and a full automated synthetic claim run
through all seven allowed tools and both specialists, ending in a complete
report pending human review. The cloud registration also passed a remote
settlement policy denial. The spoken-call check remains separate. Include
the private demo access instructions in the form, not a public post.

**ArmorIQ use:** Scoped role plans are captured and exchanged for signed intent
tokens. Tool calls go through the ArmorIQ SDK proxy to an authenticated
insurance MCP. Allowed calls create execution receipts; a forbidden diagnostic
action demonstrates a real remote policy denial before handler execution.
Local ownership, stage, lease, and argument-binding checks provide additional
boundaries. Verify and describe the actual Policy Studio setup in the video.

**ElevenLabs use:** An authenticated conversational agent invokes policy lookup,
claim draft creation, and accident-report submission through three HTTPS tools.
Expiring session capabilities bind the call to its intake; reconnect rotates
that capability. Submission requires confirmation of the current draft.

**Video:** upload a real 3–5 minute recording as unlisted YouTube, Loom, or Vimeo,
then test access from a signed-out browser.

**Public post draft (do not publish until ready):**
"Built CrashLine: voice accident intake with ElevenLabs, specialist agents, and
ArmorIQ-authorized insurance tools. The demo corrects a draft, requires explicit
confirmation, and shows a forbidden settlement request blocked before execution.
Synthetic data only. [verified demo URL] [repo URL] @ArmorIQForDevs
#FlowStateHackathon"

For LinkedIn, tag the actual ArmorIQ company page instead. Publishing the post,
uploading the video, and submitting the form require the user's action or
explicit authorization. Form: https://forms.gle/fxkXnY8xgeyZ3QQX6

Still needed: Pro console verification, full spoken call,
recording/upload, public post, and the final submission. None of these are
implied complete by this script.

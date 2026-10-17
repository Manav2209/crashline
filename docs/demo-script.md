# CrashLine demo rehearsal

## Before recording

Run the documented build, typecheck, unit tests, and local database tests. Confirm the MCP and API HTTPS endpoints are current, registered, authenticated, and reachable. Configure the selected ElevenLabs agent and confirm a signed browser connection can start.

Verify the real allow/block harness and keep its actual plan references available. Check the current database policy against POL-1001's reference document. Use only the synthetic account and incident below. Do not display provider keys, bearer tokens, session capabilities, or complete environment files while recording.

## Synthetic incident facts

- Customer: Alex Morgan, DEMO-001. Policy: POL-1001, resolved by the server.
- Incident: 15 October 2026 at 09:30 India Standard Time, UTC+05:30.
- Location: Main Street traffic signal in Demo City.
- Narrative: stopped at a red signal when another vehicle struck the rear of the car.
- Injury status: none reported; nobody is in immediate danger in this fictional scenario.
- Other vehicle: yes. Police report reference: unknown.

Read the saved draft back and confirm only after its facts are correct. A new claim ID must come from the backend; do not use the seeded example's reference as if it were a newly created claim.

## Recording sequence, approximately 90 seconds

- 0-12 seconds: show the overview and open Report an accident. Explain that the data is synthetic.
- 12-30 seconds: start the browser voice session, answer the injury check, and describe the incident. Let the assistant ask for the date/timezone and missing details.
- 30-42 seconds: show the real draft reference and actual authorized tool record. Confirm submission explicitly.
- 42-57 seconds: show the separate Policy Agent and Claims Investigator runs and their real tool activity.
- 57-73 seconds: ask for an unauthorized settlement approval. If the voice model refuses, describe it as a refusal and show the separate live enforcement harness attempt.
- 73-83 seconds: show the actual ArmorIQ decision source and provider proof, with zero blocked-handler invocations and unchanged policy state.
- 83-90 seconds: show the consolidated preliminary report and its human-review requirement.

The timings are a target for a rehearsed recording, not a latency guarantee. Keep natural pauses or use a longer recording if a real provider call takes longer. Do not fake a result to fit the time budget.

## Honest failure handling

If voice, the model provider, or enforcement is unavailable, show the actual error and resolve the setup before recording a successful path. A partial report must remain marked partial. A demo is not complete merely because the UI renders.

Use POL-1002 and POL-1003 as document examples only until their accounts/policies and authenticated selection flow are implemented. Speaking another policy ID does not grant access to it.

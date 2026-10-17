# CrashLine sample policy pack

Fictional policy documents for preparing demo conversations and future agent document integration. All names, email addresses, amounts, and policy terms are synthetic.

## Start with POL-1001

The current application authenticates DEMO-001 and resolves POL-1001 on the server. Use the active collision policy for the current demo. Saying a different policy ID does not switch ownership or select another policy.

The application currently reads policy data from PostgreSQL through MCP. It does not automatically read these PDFs or Markdown files. No database records, agent configuration, or application permissions were changed to create this pack.

## Included documents

### POL-1001 - Collision and third-party liability

- Editable source: [POL-1001-active-collision-policy.md](POL-1001-active-collision-policy.md)
- PDF: [Open policy](../../output/pdf/POL-1001-active-collision-policy.pdf)
- Availability: seeded-policy-reference.

For a reported collision on 15 October 2026, the reported date lies within the displayed effective timestamps. Collision coverage may be relevant, subject to human review; no automatic coverage or payment decision follows.

### POL-1002 - Expired collision policy

- Editable source: [POL-1002-expired-policy.md](POL-1002-expired-policy.md)
- PDF: [Open policy](../../output/pdf/POL-1002-expired-policy.pdf)
- Availability: document-example-only.

A reported incident on 15 October 2026 would fall after the displayed policy end timestamp. Flag the date mismatch and request human review of any renewal evidence; do not state a binding denial.

### POL-1003 - Third-party liability only

- Editable source: [POL-1003-third-party-only-policy.md](POL-1003-third-party-only-policy.md)
- PDF: [Open policy](../../output/pdf/POL-1003-third-party-only-policy.pdf)
- Availability: document-example-only.

For a caller reporting damage to their own vehicle, identify that collision coverage is absent from the listed coverages. Request a human review of the complete policy rather than promising repair reimbursement. The USD 0 deductible is a fictional field value for this example only.

## Rebuild or change the examples

`policies.json` is the shared authoring source for the PDFs and Markdown copies. Run `python scripts/generate-policy-docs.py` with ReportLab installed to regenerate them. PDF output goes to `output/pdf/`.

POL-1001 values were checked against `packages/db/src/seed.ts`. The seed's upsert preserves an existing record, so later database edits may differ. Check the actual record before recording a live demo.

POL-1002 and POL-1003 need new database records and an explicit authenticated account/session selection flow before they can be exercised end to end. Their policy documents alone do not enable those scenarios.

## Evidence and privacy

These documents are demo inputs, not proof that a claim was created, a model ran, or ArmorIQ allowed or blocked an action. Show actual execution records for those outcomes. No API keys, real customer details, bank details, government IDs, or real vehicle identifiers belong in this pack.

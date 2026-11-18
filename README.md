# Caustica

Caustica checks an AI repair against frozen requirements, proves that a declared coupon fault is detectable, and rejects evidence for changed requirements or different application bytes.

The owned checkout sells Caustica Field Notes for $100.00. SAVE10 must reduce its total to $90.00, persist that amount when ordering, and show the same order after reloading. Kane operates the real browser and records its assertions. Codex receives the actual failure, edits an isolated application copy, and returns a candidate that needs its own positive/control verification.

## Run locally

Use Linux or macOS with **Node24+**, Chrome and an authenticated Codex CLI. Kane is pinned to **0.10.6** in the lockfile. Local Chrome needs its normal system libraries. On Linux, a standard Google Chrome installation supplies those dependencies.

```sh
npm ci
npm run build
npx kane-cli login --oauth
codex login
npm run caustica -- doctor
npm run dev
```

The preview is at `http://127.0.0.1:4173`; stop it with Ctrl+C. Kane browser runs consume your KaneAI credits. Use `npx kane-cli balance` to check access before the demo. `doctor` checks executable readiness; it does not promise authenticated account access.

If Chrome has a nonstandard location, set `KANE_CLI_CHROME_PATH` to its executable. The development environment also supports the ignored local Chrome/library installation under `.caustica/`; judges can use their ordinary installed Chrome instead. Never put access keys in project configuration or command history. Kane’s OAuth login profile remains outside tracked application files.

```sh
npm run caustica -- freeze
npm run caustica -- verify
npm run demo
```

`freeze` creates a new approval version. `verify` runs the healthy checkout and its independent fault calibration. `demo` additionally seeds a source regression, invokes the real Codex adapter, verifies its candidate, and demonstrates two proof-reuse rejections. Allow several minutes for the five browser runs and agent repair. All artifacts and HTML reports remain under the ignored `.caustica/runs/` directory. The commands print exact run IDs and report paths.

If configuration, contract or context changes after freezing, the CLI rejects the old boundary. Explicitly freeze a new version and rerun the positive/control pair. A new freeze does not inherit an older result.

## What the demonstration proves

1. The healthy source passes the unchanged checkout contract in Kane.
2. The **independent response-layer fault** forces both quote and order totals back to $100.00, and a real Kane assertion fails with expected90 / observed100.
3. A **separate seeded source regression**, with the independent fault disabled, generates the actual failure sent to Codex.
4. The app-only proposal produces a real diff and passes a fresh positive/control pair.
5. A private contract-edit example and an old receipt against different application bytes are rejected.

The calibration fault is implemented in `controls/ignore-discount.mjs`, outside the agent-editable files. The seeded pricing regression is `demo/coupon-regression.mjs`. The developer’s original healthy source is preserved; `repair` returns a verified candidate location instead of applying it to the working tree.

## Inspect a receipt or repair a failure

```sh
npm run caustica -- inspect --receipt .caustica/runs/<verification-id>/receipt.json
npm run caustica -- report --run <verification-id>
npm run caustica -- repair --failure <checkout-failure-id>
```

The failure ID is an application execution ID from `run-record.json`, not a verification-pair ID. A repair requires a valid, unchanged failure with the independent fault disabled. For an isolated candidate, add `--source <candidate-root>` to `verify` or `inspect`.

| Result | Exit | Meaning |
|---|---:|---|
| Verified for this contract and control | 0 | Positive run passed and the matching effective control failed the intended assertion |
| Requirement failed | 1 | A supported acceptance assertion failed |
| Evidence rejected | 2 | Requirements, content, proposal boundaries or artifacts disagree |
| Run inconclusive | 3 | Missing/unsupported evidence, setup failure, ineffective control or incomplete agent execution |
| Configuration error | 4 | Invalid arguments, configuration or unavailable runtime |

These are Caustica exit codes. Kane has its own subprocess codes. An exit1, a screenshot, a model summary or a failed upload cannot independently establish a detected coupon defect. The parser requires the sealed pack, successful Kane L1 validation, matching terminal status, an actual assertion tree, its observed value, and corroborating page-state evidence. Healthy persistence additionally requires recorded document/history requests after order creation and a matching stored order.

## Evidence and recovery

Snapshots contain only explicitly declared regular files. The server imports and serves those copied bytes, records its own instance, and hashes its current files. Caustica checks the endpoint and actual served assets before and after the browser run. Source/config changes during execution invalidate approval.

Each run stores an atomic checkpoint, append-only events, child process identifiers, frozen inputs, snapshot manifests, separate stdout/stderr, original sealed evidence, normalization, and artifact hashes. `inspect` checks linked records and hashes and recomputes supported outcomes from the original terminal/pack. An interrupted run stays incomplete; inspect its process manifests and actual process identity before starting another attempt. The CLI does not automatically resume an interrupted child.

The Codex adapter checks every workspace path after execution. Contract, harness, control, evidence and input-bundle edits, added files, symlinks, deleted manifest files and empty proposals are rejected. The exact checked app proposal is copied into another isolated candidate before testing. This is an honest-local-host boundary, not malicious-host containment or remote attestation.

Raw evidence may contain account identifiers and share links, so it stays private. Only explicitly sanitized reports, summaries and synthetic checkout screenshots belong in `artifacts/public/`. The metadata fixtures in `test/fixtures/` come from genuine runs with account fields and generated code removed; omitted image bytes mean they are parser fixtures, not sealed live evidence.

## Validate

```sh
npm run check
npm test
npm run build
```

Tests cover proof reuse, artifact and source changes, effective control behavior, repair edit boundaries, malformed terminal streams, actual healthy/failed pack schemas, and missing refresh evidence. Offline tests do not replace Kane or authenticated Codex execution.

The MVP supports this owned checkout and explicit file manifest. General framework adapters, arbitrary patch application, hosted deployment, production release claims and automatic publication are outside its scope.

Sources: [Kane coding-agent guide](https://www.testmuai.com/kane-cli-agent/AGENTS.md), [Kane evidence documentation](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/evidence.md), [official OpenAI documentation for Codex non-interactive execution](https://developers.openai.com/codex/noninteractive).

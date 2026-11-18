# Caustica implementation plan

**Caustica verifies an AI repair against frozen requirements, tests whether a declared defect is detectable, and rejects results for changed requirements or a different served build.** It is the selected Witness concept under the user-approved product name.

Project root: `/home/dotmantissa/hackathons/caustica`. Prepared 18 November 2026. This document records the original build specification; README.md describes the implemented interface and current validation. The historical idea comparison remains in the sibling Kane research project.

## 1. Deliverable and definition of done

Ship a local CLI, one real checkout application, one Codex repair adapter, and an HTML report. The public repository must let a judge reproduce this story:

1. A healthy checkout satisfies the frozen contract.
2. An independently controlled missing-discount fault makes the same contract fail for the intended reason.
3. A seeded application-source regression produces a real Kane failure.
4. That actual failure reaches Codex, which edits the application source.
5. The repaired application passes the unchanged contract and the independent fault remains detectable.
6. Caustica rejects a contract-edit attempt and an old receipt for different served content.

The accepted result is **“Verified for this contract and control.”** Other product states are **“Requirement failed,” “Evidence rejected,”** and **“Run inconclusive.”** Store detailed machine reasons separately. A positive screenshot, a process exit code, a hash printed in a report, or a prepared before/after code pair cannot substitute for this story.

The MVP supports its owned checkout fixture and explicit app-file manifests. General framework adapters, mobile, a generic mutation engine, multiple agents, accounts, hosted dashboard and automatic deployment are deferred. Build only Caustica; the user selected it explicitly.

## 2. Fixed technology decisions

| Part | Decision | Reason |
|---|---|---|
| CLI/runtime | TypeScript, Node 24 LTS, npm | Current Kane dependency engines exceed the available Node 20.18; Node 24 also supplies built-in SQLite |
| CLI implementation | Commander for commands, Zod for versioned JSON validation | Clear interfaces and explicit rejection of incomplete/malformed records |
| Development | `tsx`, `typescript`, `@types/node`, Node test runner | One toolchain, no framework scaffold required |
| Verification | Exact `@testmuai/kane-cli@0.10.6` dependency and lockfile | Version/help checked in earlier research; live browser behavior still needs validation |
| Artifact reader | `fflate` for selected ZIP metadata, `yaml` for Kane metadata | Kane's documented sealed `.evidence` format is ZIP; inspect the real schema before normalizing |
| Repair | Installed Codex CLI, default authorized model/config | One actual evidence-to-code adapter; avoid a separate hosted API dependency |
| Demo application | Semantic HTML, CSS, browser ESM, Node HTTP server, `node:sqlite` | Stable served files, visible behavior and durable order history without a bundler or payment service |
| Report | Static escaped HTML and copied screenshot assets | Show the proof chain; use Kane's existing evidence viewer for full trajectories |

Exact tool versions and browser version belong in every run manifest. Commit the lockfile after installation. Validate Node 24/SQLite and the pinned Kane package together before treating this toolchain as working.

Planned package scripts are `build: tsc -p tsconfig.json`, `check: tsc --noEmit`, `test: tsx --test test/*.test.ts`, `caustica: tsx src/cli.ts`, and `demo: tsx src/cli.ts demo`. The package binary maps `caustica` to `dist/cli.js`; use NodeNext module resolution and a Node shebang on the entrypoint. Runtime dependencies are Commander, Zod, fflate, yaml and the pinned Kane CLI. Generate and retain the lockfile when the build installs them; no package versions beyond the checked Kane version are presumed available today.

The local Codex executable currently reports `codex-cli 0.163.0`. Its help confirms stdin prompts, `--json`, `--cd`, `--sandbox workspace-write` and `--skip-git-repo-check`. Help success establishes the interface only; account/quota, execution and actual repair remain unverified.

## 3. Planned repository layout

```text
caustica/
  PLAN.md
  TASKS.md                         # locally ignored recovery checklist
  README.md
  package.json
  package-lock.json
  tsconfig.json
  caustica.config.json             # explicit fixture input/launch definition
  contracts/
    checkout.json                 # acceptance text + typed requirements
    context.md                    # explicit neutral Kane context
  controls/
    ignore-discount.mjs            # independent response-layer fault
  demo/
    server.mjs                    # trusted fixture server and build identity
    coupon-regression.mjs          # seeded broken pricing implementation
  apps/checkout/
    src/pricing.mjs                # editable application business logic
    public/index.html
    public/app.mjs
    public/styles.css
  src/
    cli.ts                        # commands, argv and exit codes
    config.ts                     # schemas and approved configuration
    snapshot.ts                   # manifest, hashing and stable app copies
    fixture.ts                    # process launch, health and served identity
    kane.ts                       # bounded subprocess and terminal stream
    evidence.ts                   # sealed pack normalization and classification
    approval.ts                   # pure acceptance/rejection rules
    repair.ts                     # Codex invocation and app diff validation
    run-store.ts                  # append-only events and atomic checkpoint
    report.ts                     # readable local proof report
  test/
    approval.test.ts
    kane-stream.test.ts
    repair-boundary.test.ts
    fixture-identity.test.ts
  artifacts/public/               # explicitly sanitized submission examples
  .caustica/                      # ignored local snapshots/runs/proposals
  .gitignore
```

Agent-editable files are restricted to the explicit manifest beneath `apps/checkout/src/` and `apps/checkout/public/`. Contract, control, harness, verifier, report, dependency and receipt files are outside that edit set. The adapter checks actual changed bytes and paths; a prompt instruction is not enforcement.

Snapshots copy only declared regular files from the requested project root. Reject symlink inputs and paths outside that root; do not recursively inspect the user's home directory or the restricted `~/lab` directory.

## 4. Checkout application contract

Use one product, **Caustica Field Notes**, priced at **10,000 cents**, quantity one. There are no taxes, shipping, currency conversion or external payments. `SAVE10` deducts 1,000 cents; expected total is 9,000 cents. All arithmetic uses integer cents.

The UI exposes a product, labeled coupon input, Apply coupon button, explicit subtotal/discount/total, Place order button and Order history. Use real native controls. The history survives browser refresh and reads persisted server records.

The typed application pricing interface is:

```ts
type Quote = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};
// apps/checkout/src/pricing.mjs exports quote(quantity, coupon): Quote
```

`demo/server.mjs` imports the snapshotted pricing module, serves the snapshotted public assets, and stores orders in a fresh per-run SQLite file. Both quote and order creation use the same pricing interface. Routes:

| Route | Behavior |
|---|---|
| `GET /` and `GET /assets/*` | Serve only declared snapshot files; disable browser caching for the demo |
| `POST /api/quote` | Return validated integer-cent quote for quantity/coupon |
| `POST /api/orders` | Recalculate server-side, persist product/coupon/total and return the order ID |
| `GET /api/orders` | Read the persisted order history |
| `GET /__caustica/health` | Signal server readiness |
| `GET /__caustica/build` | Report server instance, input/asset digests and active control identity |

Bind the server to `127.0.0.1` on an available port. Each verification uses a fresh database and browser profile, giving deterministic reset without a public reset endpoint. Refresh stays within the same run/server/database. Shut down only the process launched for that run.

The initial contract has three acceptance IDs:

- `coupon-total`: applying SAVE10 visibly changes the total from $100.00 to $90.00.
- `order-total`: placing the order stores the $90.00 amount with the expected product/coupon.
- `order-refresh`: after refresh, order history displays that persisted order and amount.

A proposed Kane objective is: “Go to {{app_url}}, apply SAVE10 to Caustica Field Notes, store the displayed total as 'displayed_total', assert the total is 90 dollars, place the order, store its identifier as 'order_id', refresh, open order history, and assert the same order has a 90 dollar total.” Tune this during the first real flow, **then freeze it**. Record every revised contract as a new version and rerun baseline/control; do not inherit proof from an older version.

## 5. Contract freezing and content identity

`freeze` creates an immutable local contract record containing the contract text/typed requirements, explicit context bytes, fixed non-secret variables, allowed runtime substitutions, app manifest, harness/control definitions, launch policy and tool requirements. Use deterministic canonical JSON and SHA-256. Read actual contract bytes again before and after repair/verification.

Allow only `app_url` and run-specific identifiers as runtime substitutions; they do not alter the acceptance requirement. Record their resolved values and the resolved objective digest per run. Pass explicit global/local context files and a controlled variables file; record the configuration consumed by Kane. If unaccounted global variables or settings influence the run, do not claim all execution inputs were frozen.

For each snapshot:

1. Hash sorted relative paths and file bytes from the declared input manifest, including dirty/uncommitted source. Use length-delimited records to avoid concatenation ambiguity.
2. Hash the harness, control and launch settings separately. Exclude receipt output, database state, dependency caches, credentials and absolute project location from source-content identity.
3. Copy the declared app files to a unique snapshot and launch its server. The server imports and serves this copy, not the changing developer working directory.
4. Read the build endpoint and fetch actual served assets; compare their bytes with the recorded snapshot. Keep server instance and browser version in the run record.
5. Repeat identity checks after Kane exits; reject changes during execution.

Approval identity is the frozen contract plus app content plus declared control/harness/execution policy. A run's ephemeral URL/process ID is provenance, not a transferable proof that another process is still serving the same content. Before using an archived receipt for a currently running target, recheck the actual served identity.

This is reproducibility on an honest local host. An application/host could lie about its own identity; Caustica is not remote attestation or malicious-agent containment.

## 6. Independent control versus application regression

Keep these mechanisms separate:

**Calibration control:** `controls/ignore-discount.mjs` wraps the server's real pricing result and overrides `discountCents` to zero and `totalCents` to `subtotalCents`. The application remains reachable and checkout still executes. The control is implemented outside agent-editable app files and is applied consistently to quote/order creation. Its active mode and file digest are part of the run identity. Check the quote response before Kane to confirm it really removes SAVE10's effect while the server remains healthy. That HTTP check establishes control setup; Kane must still demonstrate the visible failed requirement.

**Repair regression:** `demo/coupon-regression.mjs` is a deliberately broken application pricing implementation used in a private copy of the app. It ignores SAVE10 even with the calibration control disabled. Codex must change this application's source to repair the behavior. Do not ask Codex to edit the independent control or provide a prewritten repaired file.

This response-layer control replaces the earlier proposed source-patch calibration to avoid patch conflicts after repair. It is a named fault injection, not a general source mutation engine. Clearly label both the injected control and the seeded regression in the demo. After repair, revalidate the control's effect; an ineffective control is **inconclusive**, not “caught.”

## 7. CLI and verification flow

Expose the compiled `caustica` binary and equivalent development command `npm run caustica -- …`. Planned commands:

| Command | Concrete result |
|---|---|
| `doctor` | Check Node, pinned Kane, Chrome path/version and Codex interface; explain missing prerequisites without printing secrets |
| `freeze --config caustica.config.json` | Store the approved contract/config digests and frozen input copies |
| `verify --config caustica.config.json` | Snapshot, run healthy contract and fault calibration, then write classified receipt/report |
| `repair --config caustica.config.json --failure <run-id>` | Pass actual failure to Codex, inspect its app-only proposal, verify candidate and return validated diff/result |
| `inspect --receipt <path> --config caustica.config.json` | Recheck artifact digests and contract/current source identity; reject mismatched proof |
| `report --run <run-id>` | Render static report from persisted actual records |
| `demo` | Run the owned healthy/control/broken/repair sequence in private app copies and record the two rejection examples |

The MVP `repair` returns a verified candidate location and diff. `demo` runs that candidate as the repaired application. Applying a candidate to an arbitrary caller's source tree is deferred; the end-to-end demo still performs and executes a real code repair.

Use Caustica exit codes `0 = verified`, `1 = requirement failed`, `2 = evidence rejected`, `3 = inconclusive`, `4 = usage/configuration error`. These differ from Kane's exit codes and must be explained in the README. A demo can finish successfully while containing expected fault failures and rejection cases; its final result must enumerate every expected outcome rather than treating every nonzero subprocess as a global failure.

Run Kane using a fixed argument array and stdin closed. Include `--agent`, `--headless`, `--timeout 120`, `--max-steps 20`, `--final-validation on`, `--assertion-failure-mode stop`, a unique `--name`, a fresh `--chrome-profile`, explicit context files and controlled variables. Do not execute commands suggested in Kane/model output. Named runs put the evidence pack in the project store; run in a per-run workspace so outputs are isolated.

Budget one healthy and one controlled checkout run before repair, one broken run, one repaired run and one repaired-control run: **five checkout runs**. Eligibility smoke flows and an optional clean replay are additional. Measure real runtime/credits early; do not assume a cost per run or that the advertised credit allocation has been claimed.

## 8. Evidence normalization and approval rules

`kane.ts` persists stdout NDJSON and stderr separately, plus timestamps, exit status and child identity. Identify terminal `run_end`; do not infer completion from progress text. Missing terminal event, conflicting terminals, timeout, cancelled process or mismatched status is inconclusive/rejected according to the recorded reason.

`evidence.ts` locates only this named run's pack in its known project/session store, calls Kane's own evidence validator, copies the original into the run directory and hashes it. A `.evidence` pack is documented as ZIP with `run.yaml`, per-test `result.yaml`, `step.json`, step `failure.yaml`, action NDJSON and execution trajectory. **Inspect a real successful and failed pack before coding field mappings.** Keep unknown schemas unsupported; do not invent an assertion result shape.

Normalize observed records into:

```ts
type EvidenceOutcome =
  | { kind: 'passed'; evidenceDigest: string; observations: Observation[] }
  | { kind: 'assertion-failed'; acceptanceId: string;
      expected: unknown; observed: unknown; evidenceDigest: string }
  | { kind: 'inconclusive'; reason: string };
```

Relevant `coupon-total` failure requires a real failed assertion checkpoint and corroborating observed total/page state for the healthy checkout route. Match the observed defect against the typed requirement and actual failure/action record. `displayed_total` extraction may corroborate it; a summary phrase or exit `1` alone cannot establish it. Navigation, upload, authentication, browser, model and unknown failures are not detected coupon defects.

A final candidate receives verified status only when all conditions hold:

- Current contract/context/control boundary matches the frozen record.
- Declared served content matched the launched snapshot before/after execution.
- A real healthy-contract run passed with valid artifacts.
- Its matching calibration run reached checkout and failed the intended requirement under a still-effective control.
- Actual source edits stay inside the allowed manifest; relevant files did not change during testing.
- Receipt links to complete, unchanged terminal/action/failure/evidence artifacts.

Old healthy evidence must not certify repaired content automatically; the repaired candidate needs its own positive/control pair. A changed acceptance contract needs a newly frozen record and fresh calibration.

## 9. Codex repair adapter

Create a unique repair workspace containing the application copy and an input bundle with the frozen requirement, actual failed assertion, relevant screenshot paths, raw terminal result and source manifest. Generate a prompt that states the observed failure and required behavior without supplying replacement code. Limit repair to the app manifest and a two-attempt, ten-minute wall-clock budget.

Spawn the locally supported command as argv, without a shell:

```text
codex exec --json --sandbox workspace-write
  --cd <repair-workspace> --skip-git-repo-check -
```

Write the prompt to stdin; capture its actual JSONL transcript, final response, exit and duration. Use existing authorized authentication/model configuration. The workspace sandbox is supplementary; hash/diff checks decide whether the proposal is admissible. No new paid API, account or broad directory access is assumed.

After completion, compare every workspace file against the initial manifest. Reject edits to input/contract/control/verifier/dependency files, outside paths or unexpected new executable/config files. Require a real app diff. Snapshot the candidate and run the unchanged contract plus independent control. On a further relevant failure, feed the new evidence into the second attempt. Preserve both attempts; exhausted budget or unavailable agent remains inconclusive.

If noninteractive execution cannot use the existing account/configuration, a developer can load the same actual evidence bundle into the available coding agent, then submit its app diff for the same verification. Label that mode as developer-mediated feedback, with an actual source change and rerun. Do not present it as an autonomous subprocess loop.

## 10. Run persistence and recovery

Use `.caustica/runs/<run-id>/` with:

```text
state.json                        # atomically replaced checkpoint
events.ndjson                     # append-only stage history
frozen-inputs.json
snapshot-manifest.json
launch.json
browser-profile/
data/orders.sqlite
kane/stdout.ndjson
kane/stderr.log
kane/original.evidence
evidence-normalized.json
repair/                           # actual bundle/transcript/candidate/diff
receipt.json
report.html
```

Stages: `created → frozen → snapshot-ready → server-ready → kane-running → evidence-recorded → classified → control-checked → finished`; repair records its own proposal/check/attempt stages. Persist each operation before launching its child. Record PID, executable, start time, server port/instance and run ID. On recovery, check process identity before interacting with a PID and recompute artifact/input identity before resuming. Never continue a run using changed snapshot/config bytes.

Receipts are append-only/versioned; use a new receipt for every attempt. Reports derive from recorded state and never manufacture pass/fail rows. Keep raw account-bearing packs private; export only checked synthetic screenshots, sanitized summaries and explicit provenance references for the public demo. Store no access keys in config, Git or TASKS.md.

## 11. Required tests and demonstrations

Automated tests cover consequential rejection logic and process boundaries. Do not build tests that only repeat implementation getters or fixture CSS details.

| Check | Expected result | Test layer |
|---|---|---|
| Healthy contract + relevant matching control failure | Verified for that contract/control | Live Kane integration |
| Coupon source regression; agent app repair | Real failure → actual diff → repaired positive/control pair | Live Kane + Codex |
| Edit frozen acceptance from $90 to $100 | Evidence rejected; no reuse of earlier proof | Unit + runnable rejection demo |
| Changed JS/pricing bytes with old receipt | Evidence rejected | Unit + stale-build demo |
| Stale server or asset cache disagrees with source snapshot | Identity rejected before/after browser run | Local fixture integration |
| Kane exit 1 for upload error or navigation failure | Inconclusive, never a detected coupon defect | Recorded real-schema fixture/parser test |
| Missing/truncated/conflicting terminal stream | Inconclusive/rejected with durable reason | Stream test |
| Control disabled/ineffective or output schema changed | Inconclusive, never “control caught” | Local + live control check |
| Agent edits copied contract/input or verifier file | Proposal rejected even if application appears green | Boundary test |
| Agent produces no app diff or exceeds budget | Inconclusive; preserve attempt | Adapter test |
| Changed snapshot during run or altered evidence artifact | Evidence rejected | Identity/approval test |
| Order viewed after refresh | Same persisted product/order/amount | Live browser plus direct SQLite corroboration |

Collect representative real Kane records in the first integration spike for offline parser tests. Offline fixtures establish classifier behavior only; they cannot replace live sponsor or agent execution. Ordinary contract failure is a valid recorded result, but does not approve a candidate.

## 12. Report and four-minute demo

Report: one timeline with contract version, tested build, healthy result, control result, actual agent diff, repaired result and rejection reasons. Show screenshot thumbnails from genuine runs, expected/observed amount, duration/credits when reported, and paths to complete Kane evidence. Use plain product labels from section 1. Provide useful missing-prerequisite/error messages. Display proof scope explicitly; avoid a broad release-ready badge.

The owned checkout should look credible on desktop and narrow screens, have clear labels and total hierarchy, and expose loading/failed submission/order states. Avoid spending build hours on effects or a separate dashboard.

Recorded YouTube outline:

- 0:00–0:25: developer problem, Caustica contract and real checkout.
- 0:25–1:05: healthy result, declared control and Kane's meaningful failure.
- 1:05–1:45: actual seeded application regression, failure material reaching Codex and its source diff.
- 1:45–2:25: repaired application, order history after refresh and matching fault calibration.
- 2:25–3:10: deliberately edited contract and old-build receipt are rejected.
- 3:10–3:45: CLI/report and reproducible setup.
- 3:45–4:00: bounded claim and public repository.

Compress waiting transparently. Label controlled faults and seeded regressions. Keep the raw run identifiers so judges can correlate footage and artifacts. Never stage canned Kane responses as real execution.

## 13. Ordered build milestones and time budget

The official deadline is **19 November 2026 at 23:59 IST / 18:29 UTC / 19:29 Lagos**. Roughly 32 hours remained when this plan started. Budget **12 productive hours**, including submission. Aim to submit by 16:00 Lagos on the 19th; reserve the remaining clock time for service/submission issues. Use actual current time when beginning implementation.

| Milestone | Budget | Implementation and exit condition |
|---|---:|---|
| M0: prerequisite spike | 0.5 h | Confirm registration/claimed same-email credits; Node24, Chrome and Kane. Run one real example.com flow before app coding, then a deliberately wrong assertion. Record cost/artifacts; missing live access stays a blocker |
| M1: app + localhost spike | 1.25 h | Implement owned checkout/server/pricing/order history. One real healthy localhost objective and inspected successful/failed pack schema; contract ready to freeze |
| M2: identity + approval core | 2 h | Implement config/freeze/snapshot/launch identity, receipt schema and pure rejection gates. Changed-contract and stale-asset tests pass |
| M3: Kane + calibration | 1.25 h | Implement named bounded runner, artifact normalization and independent response fault. Positive/meaningful-negative pair recorded |
| M4: real repair | 1.5 h | Seed private application regression, run actual Codex adapter, inspect app diff, verify candidate/control. One authentic closed loop completes |
| M5: report + rejection demo | 1 h | Render actual report; expose runnable edited-contract/old-build rejection examples; write setup commands |
| M6: validation + clean replay | 2 h | Run targeted tests and one clean reproducibility pass, confirm control semantics and durable order; archive exact source/lockfile/tool versions |
| M7: delivery | 2.5 h | Public README/repository, authentic four-minute video, two public posts and submission form with working URLs |

Before each long operation, update TASKS.md with current task, dependency, process/run identifier and exact recovery step. Separate implementation completion from successful live validation and submission.

At M0, resolve shared access before large implementation. At M3, unsupported artifact classification remains inconclusive; do not replace it with summary-text guessing. At M4, timebox subprocess integration and use honestly labeled developer-mediated feedback if needed. Keep both proof-rejection cases even if report styling is reduced; these demonstrate Caustica's contribution. No automatic change to another project idea is authorized.

## 14. Submission and current state

Required: new public event-period GitHub repository, application/agent/Kane explanation, three-to-five-minute YouTube demo, two distinct public posts on supported platforms, and runnable judge setup with secure access/fallback for services. Live deploy is optional. No pushes after the official deadline. Registration/credits and a Kane flow precede application coding.

Use a working recorded fallback for Kane/agent service availability and check how judges can access evidence; it does not replace the actual integration during the build. Draft launch copy after the proof exists. Public publication/account actions are separate delivery work, not completed by this planning turn.

**Initial planning checkpoint (historical):** created the sibling Caustica directory, initialized a fresh `main` repository, maintained a root ignored checklist, verified agent-file ignore rules, inspected prior research and checked the installed Codex help/version. Implementation and live validation now proceed in the existing repository; see README.md and the canonical ignored TASKS.md for current evidence.

**Original first build step (historical):** complete M0 and record a real healthy/incorrect assertion pair plus usable evidence, then scaffold the owned server/app and explicit input manifest. Success states require actual recorded execution.

## 15. Source basis and limits

- [Official hackathon rules and deadline](https://www.kaneclihack.sh/).
- [Kane CLI README: runtime, NDJSON and exit semantics](https://github.com/LambdaTest/kane-cli).
- [Kane evidence pack structure](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/evidence.md).
- [Kane policies already provide evidence gates](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/policies.md).
- [Stryker mutation testing](https://stryker-mutator.io/docs/) and [FlytBase SentiNEL](https://github.com/siddhant-pardeshi/flytbase-ahc-agentic-testing) establish prior art for test calibration/browser fault controls. Their published implementation claims were not independently rerun.

The historical fresh-context reviewer required real rejection behavior, actual served identity, relevant assertion failure classification, still-effective controls and a real source repair. Those corrections are incorporated above. This implementation plan has not itself been independently reviewed or execution-validated. Caustica's contribution is the demonstrated contract/content approval behavior; passing this bounded fixture is not complete correctness or proof of winning.

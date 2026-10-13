# Workflow

## Delivery workflow

Read project context → define user outcome and acceptance criteria → discover relevant code through the graph when available → design business states and failure cases → implement a bounded change → verify → update documentation and progress.

Resolve routine reversible implementation choices autonomously. Ask for missing business decisions where competing policies change behavior. Record architectural decisions with rationale and implications.

### Execution lanes

| Lane | Selection | Agent use | Verification |
|---|---|---|---|
| Fast | Reversible, isolated, low-risk change | Main session or one owner | Targeted check only |
| Standard | Normal feature or cross-layer change | Only owners of affected layers; one QA pass after freeze | Acceptance checks and affected suites |
| Deep | Auth/access, tenant boundaries, migrations, money, stock posting, concurrency, destructive behavior | Required specialists and independent QA | Targeted development checks, then one full regression |

Minhaj records the lane in the active feature assignment. Escalate a lane when evidence reveals broader risk. Do not downgrade Deep categories.

### Cost and time controls

- Read the active feature file and directly relevant standards. Do not reread all research or historic handoffs unless a gap requires it.
- Keep one owner per file and one owner for database-connected tests at a time.
- During implementation, run the narrowest meaningful tests. The designated verifier owns the final broad suite.
- Do not repeat a passing broad suite after documentation or isolated test-only changes. Rerun the failed test and affected group.
- Use this handoff shape: outcome; contracts or migrations; validation with counts; unresolved risks. Omit chronological work logs.
- Use dashboard automatic observation. Manual reports are for handoffs, not heartbeats.
- Stop delegating once the task is small enough for the main session to finish safely.

## Operational workflows

| Workflow | Sequence |
|---|---|
| Onboarding | Create tenant → legal/tax settings → locations/roles → import preview → validated opening stock → barcode/hardware checks → reconcile → go live |
| Procurement | Draft PO → approve → order → partial/full receipt → inspect → post sellable/quarantine stock → reconcile supplier records |
| Transfer | Request → approve → dispatch → in transit → partial/full receive → resolve discrepancy → close |
| Store sale | Open shift → scan/select variant → price/discount/tax → collect tenders → post sale/stock → receipt → close/reconcile shift |
| Online sale | Import order → validate mapping → reserve available stock → payment/COD confirmation → pick/pack → book courier → dispatch → delivery → reconcile settlement |
| Return/exchange | Find original sale → check policy/remaining returnable quantity → inspect goods → post return → refund or linked replacement sale → settle difference |
| Stock count | Establish cutoff/freeze policy → blind count → variance/recount → approval → adjustment posting |
| Integration failure | Record event → retry safely → expose unresolved exception → replay/reconcile → verify stock/order consistency |

## State rules

Cancellation releases active reservations once. Dispatch consumes reserved stock once. Return initiation never increases stock; inspected receipt does. Payment, shipment and order lifecycles remain independent and linked.

Offline queue synchronization is a separate workflow with visible success/conflict states and deterministic replay.

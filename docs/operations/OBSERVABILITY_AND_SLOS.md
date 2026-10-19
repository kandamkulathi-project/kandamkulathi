# Observability, SLIs and operating objectives

**Owners:** Devadathan platform; Mathew clinical/AI/jobs; Josin financial/stock reconciliation; company support primary/backup receives actual alerts. Every alert needs service/environment/operation/current-state context, impact, owner, action and tested receipt. Keep secrets/health text/private links/addresses out of logs.

| Signal | Final acceptance / objective | Evidence / interpretation |
|---|---|---|
| Dynamic core reads/writes | India read p95 <500 ms; write p95 <1 s; unexpected server errors <1% | Final stated workload/data/mix; distinguish providers/expected valid conflicts, report end-to-end and transaction time. |
| Retained workload | 60 rps/30 min, 120 rps/5 min, 20 rps/4 h soak | 65% catalogue,15% account,10% cart,5% checkout,5% booking; jobs/AI/video declared; no unexplained leak/invariant/access breach. |
| Database | Initial in-DB core transaction p95 <100 ms excluding transport; no sustained pool/lock backlog | Actual region/compute/cache/query round trips, cold/minimum and ramp measured; tune/resize/cost update if gates fail. |
| Jobs | Healthy due-to-claim p95 <2 min | Actual server timestamps/sample; financial/clinical progress protected, current deadlines/consent/version suppress stale work; fault recovery separately measured. |
| AI | Nonclinical first useful output p95 <5 s; ten active generations plus overload bounded | Safety checks never bypassed; lease/rate/timeout/fallback metrics; direct core survives AI outage. |
| Video | At least five simultaneous private two-person calls | Real required devices/network/TURN and access/reconnect/quality proof; no unlimited-capacity inference. |
| Public web | Key-page mobile LCP <2.5 s objective | Agreed representative Indian mobile profile; no fabricated benchmark. |
| Availability | 99.9% rolling-month internal core objective | Define successful authorized core requests/probe, denominator/exclusions/window/owner in actual config. Prelaunch tests cannot prove achieved monthly availability; no premium SLA implied. |
| Recovery | PITR <=15 min RPO / <=2 h validated resume; compatible Worker/web rollback <=15 min | Independent nightly export RPO up to24 h and separate measured recovery; object/role/provider control proof. |

Monitor API unexpected errors/latency, DB CPU/cache/pool/locks, stock/ledger/doctor-interval anomalies, provider unknown states/mismatch, outbox age/leases/DLQ/deadlines, KB approval/withdrawal/freshness/usage, clinical/human escalation, model/media usage and backup age/object manifests. Track core vs Companion budgets and actual tokens/audio/messages/compute/staging/history/TURN/storage. Budget alerts at reviewed thresholds must not disable mandatory financial/clinical safety work.

Before Go set actual production alert thresholds/durations, observation window and reachable primary/backup contacts; rehearse receipt and action. Those settings are Pending, not activated by a table. Preserve protected load/soak windows from unrelated resets/deployments/destructive/scanner work and use verified isolated fault targets or serialization.

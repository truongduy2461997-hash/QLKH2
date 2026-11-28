# QLKH2 — Technical state, 2026-11-28
## Architecture
GitHub Pages frontend: index.html orchestrates QLKH, Chi tiêu, Tiện ích, KPI & Lương and Radar Lead. QLKH source src/qlkh.html is not necessarily identical to deployed gzip/Base64 modules/qlkh.v1000.data.js; runtime patches in index.html currently provide critical functionality. Inspect actual decoded module before changes, and keep patches until equivalent source/build is verified. KPI module kpi-salary.html. Firebase Auth restricts access; Firestore stores QLKH state and dataset; RTDB integrates other state and Lead/KPI; browser storage provides local persistence.
## Verified on repository at documentation time
index.html blob 0ef1d3e303d041009716064c29dd664e5b348a7e contains cloudWriteStateAtomic, mergeRadarLeads, kpiSalaryFrame and qlkhOwnerFetch. This confirms presence, not end-to-end behavior. Verify HEAD and actual runtime before relying on them.
## Existing designs and constraints
- QLKH outstanding installments must remain visible until paid; paid items move to processed ledger; undo restores correct item. Preserve per-contract identity, notes, manual amounts, overdue history and local unsynced edits.
- Firestore root write exceeded 1 MiB (1,231,264 bytes observed). Runtime sharding writes immutable chunks plus manifest atomically, validates checksum and supports old reads. Keep current plus two tracked technical versions; unknown orphan documents are not automatically deleted. Test actual decoded module, transaction limits, concurrent devices and Unicode with synthetic data.
- RTDB polling target: QLKH 60s, KPI 120s, Lead 300s, active tab only; pause background reads, preserve pending writes. Firestore listener separate. Usage estimates are not billing metrics. Verify implementation; no real quota savings proven.
- KPI cloud uses owner authentication, ETag conditional writes, schema JSON serialization, local backup and conflict handling. Preserve reporting history and existing formula logic. Estimates are not official compensation.
- Radar must merge current and remote rows by stable identity, preserve new rows when old remote snapshot arrives, deduplicate, order newest first. Status writes verify identity and ETag. Lead existing only in GitHub cannot yet save status remotely. Collector separation remains pending.
- Keep responsive layout, iPhone Safari and desktop. Never loosen security rules to solve auth errors.
## Reference commits (historical, not HEAD)
2799236 usage/polling/retention; 7beb9a5 KPI polling; 6dda54b restored app after overwrite; 7c9e599 merge Lead and conditional status writes. Actual production behavior not verified by ChatGPT.

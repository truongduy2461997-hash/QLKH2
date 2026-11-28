# Handover — ChatGPT to Antigravity
Updated 2026-11-28. Read AGENTS.md and PROJECT_STATE.md first; check git status and origin/main. Do not paste full history into context.
## Current priority
1. Inspect running Lead collector and its write targets without stopping or changing it. Determine whether it rewrites index.html from an older local copy. This is a hypothesis, not confirmed.
2. Preserve new Lead and contact status. Propose an authenticated independent data path; avoid publishing private data in this public repository. Do not run migration or alter rules without owner approval.
3. Verify actual decoded QLKH runtime contains sharding and can roundtrip synthetic >1 MiB payloads; check KPI and authentication after any build. Check Lead merge with stale and fresh snapshots, and status conflicts. Do not touch production data for tests.
4. Maintain short checkpoint here: task, branch, HEAD, changed files, actual tests, limitations, next action, unsaved changes. Archive old entries rather than accumulating entire chat.
## Bridge status
Remote Desktop Commander detected the laptop and previously executed a read-only command successfully. Latest laptop inspection has not returned a result. No Antigravity prompt API/CLI or direct bidirectional control verified. Do not claim bridge active. If official supported integration exists, verify it in a separate test session; never inject keystrokes into the active Lead session or use undocumented authentication endpoints.
## Reporting
Return a short technical summary and commit references. Keep shared docs public-safe, never include secrets or real customer records. No code changes authorized by this handover alone.

# tests

Browser tests driven by Playwright against the real HTML pages, with
`shim.js` standing in for supabase-js. Kept in the repo (not a temp folder)
since 2026-10-26: the earlier suites lived in a scratch folder and were lost
when the cloud machine was replaced.

Run from the repo root:

    python3 -m http.server 8137 &
    node tests/errors.test.js

`shim.js` mirrors the query-builder shape only. Database maths, RLS and
function-overload resolution are not simulated — check those against the
real database (see BUG46 in CLAUDE.md).

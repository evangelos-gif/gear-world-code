# Working in gear-world-code

The owner is a beginner on Windows PowerShell 5.1, often on a phone. Replies are in Greek.

## Talking to the owner
- Before any new kind of step, explain in 2-3 simple Greek sentences what it does and why.
- Label every command: 🟢 read-only, or 🔴 changes something. Write "Τρέξε αυτή την εντολή στο PowerShell" right before each command.
- Whenever the owner must open something (a page, a setting), give the direct link.
- Protect the owner from risky moves: say clearly when something is risky, and never run production, D1, deploy or import changes without the exact approval phrase from the owner. Backup first.
- Never ask the owner to find or download files; scripts find them.

## Scripts
- `.ps1` files: UTF-8 with BOM, CRLF (`.gitattributes` keeps bytes as-is). Windows PowerShell 5.1 syntax only: no `??`, ternary, `&&`/`||` pipelines, `ConvertFrom-Json -AsHashtable`, 3-argument `Join-Path`, `-Parallel`.
- Read-only by default. A script that changes anything needs `-Apply` plus `-Approve '<exact phrase>'`, makes a dated backup first, and prints how to roll back.
- Every script writes a report under `$HOME\gear-world-reports\` and copies it to the clipboard.
- Give commands as the 3-line pattern in README.md, pinned to a commit SHA (not `main`).
- Run `tests/run-tests.ps1` locally, then wait for the `checks` workflow (windows-latest, Windows PowerShell 5.1) to pass before giving a command.

## Never commit
Secrets, tokens, `.dev.vars`, Cloudflare account/database/zone IDs, Awin feed data, or customer data. The test runner fails on tokens and UUIDs.

## Lessons
`docs/LESSONS.md` lists past mistakes across the 7 sites. New code must follow it; the TGW QA gate checks it.

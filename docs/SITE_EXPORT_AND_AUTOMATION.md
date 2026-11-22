# Minute Arcade: source transfer and autonomous delivery

## Source of truth

The original, existing ChatGPT Site is authoritative. Its source is not reconstructed from public JS. Open the owner account's ChatGPT Sites entry for Minute Arcade -> Edit; ask the original Site/Codex environment to export the COMPLETE existing source as a ZIP without changing the live Site. Review the exact export tree once available. The recovered 20-file frontend on this branch is a backup, not a replacement for the original backend.

## Exact import procedure (no rewrites)

1. Receive the unmodified ZIP exported by the original Site's Codex context.
2. Run: \`python scripts/stage-site-export.py path/to/original-export.zip /tmp/minute-arcade-original\`.
3. Compare the integrity report with the extracted files. Identify whether the ZIP includes backend sources, build manifests, migrations, and server configuration. Do not expose secrets.
4. Create the PRIVATE dedicated \`ACD052709/minute-arcade\` repository using a properly authorized GitHub session or repository-creation API call. The currently available GitHub connector does not provide a repository-create action; that is a tool/connection task, not an end-state architectural restriction.
5. Import the original exported files, byte-for-byte, into the new repository, retaining its source directory structure. Commit to its main branch as the baseline. Keep the snapshot branch for comparison; do not silently overwrite authoritative code with snapshot enhancements.
6. Import and preserve all required server-side configuration names, but configure secret values through a secrets manager only. Do not add secret values to GitHub.
7. Obtain and separately migrate any database records and stored files needed for player identity and scores. Source ZIP alone is not a live data backup.
8. Determine the deployment runtime from the original source. Cloudflare Workers is an option only if the original runtime is compatible; alternatively use a compatible host. Create staging before any DNS changes.
9. Test all 13 games, demos, account creation/login, existing guest identities, points, score synchronization, rankings, share links, privacy, and mobile layouts using isolated test accounts. Compare API response contracts with the live service. Do not change existing production records during tests.
10. Configure staging and production deployment via repository-connected CI/CD, with explicit environment isolation and least-privilege credentials; deploy only after complete tests.
11. Preserve the live custom domain until staging is proven. Back up data, plan a non-destructive cutover, then move the apex and configure www redirect. Verify TLS and all functionality. Keep a rollback path.

## Autonomous changes after migration

- Authorized coding agent creates a branch/PR for each request.
- CI: lint, typecheck, unit and browser integration tests, database migration checks, and security validation appropriate to the original codebase.
- Passing PR deploys to isolated staging; automated E2E tests verify game and account behavior.
- Successful candidate is promoted under branch protections/release rules; production deployment uses configured repository secrets and never requires manual file transfer.
- Automated post-deploy health and regression checks run; stop or roll back releases when code-level rollback is safe. DB migrations require their own recovery approach.
- Logs record commit SHA, deployment ID, test evidence, and rollback status. Fail closed on missing secrets or unverified artifacts rather than publishing an incomplete frontend.

## Current state

- Live canonical site: https://minute-arcade.com (ChatGPT Sites hosting).
- Existing recovered public frontend: 20 files in this branch.
- Source export: not yet obtained from the original authenticated ChatGPT Sites editing context.
- Dedicated new repo, backend import, staging/prod deploy and data migration: not yet executed.
- This branch intentionally contains no autonomous production deployment workflow until the original source and target runtime are available.

Notion project record: https://app.notion.com/p/4201cd0d7480819fb177d0ba86ee85ab

## One-command repository creation and exact-byte original source import

Once the original full source ZIP has been exported by the authenticated Minute Arcade Site/Codex context, run the following from an authorized GitHub CLI environment:

    bash scripts/create-dedicated-repo.sh /path/to/original-site-export.zip ACD052709/minute-arcade

The command creates a new private repository, stages the original source ZIP without modifying backend files, generates per-file SHA-256 hashes, rejects unsafe paths and common secret-file names, imports the original files, verifies the bytes and commits to main. It refuses to overwrite an existing repository. It does **not** migrate server records or change the working production domain. The available GitHub connector can write branches/files but lacks repository creation; no authenticated GitHub CLI session is available from this chat at present.

The GitHub CI verifies the importer against a synthetic archive (including a backend file), detects tampering and path traversal, and checks 20 public frontend files. Deployment pipeline configuration awaits the original code's actual runtime and storage model.

# Minute Arcade — recovered public frontend (2026-11-22)

This branch contains an exact snapshot of the public HTML, CSS and JavaScript served at https://minute-arcade.com on 2026-11-22. It was reconstructed by downloading the publicly served site files; it is NOT an export of the private ChatGPT Sites project or server-side code.

## Limitations

- The live site's server-side implementation of `/api/*`, user account authentication, sessions, points, leaderboards, ads placement handling, persistence and deployment configuration was **not** publicly retrievable and is not included.
- Publishing this static frontend without its server backend will NOT restore accounts, scores, points or other API features. Do not point the production domain to a new host based on these files alone.
- This snapshot branch is hosted temporarily in an existing GitHub test repository because the connected GitHub tool can write to repositories but cannot create a new repository. The test repository's `main` branch remains unchanged.
- The original ChatGPT Site and custom domain remain the source of truth and were not modified by this snapshot.

## Files

- `index.html` — homepage and game interface
- `privacy.html` — privacy page
- `style.css`, `arcade.css`, `club.css` — styling
- `foundation.js`, `games.js`, `more-games.js` — frontend game framework
- `arcade/*.js` — separate modules for games, user experience, demos and client-side API use

## Recovery and safe migration

1. Export or reconstruct the site's server-side worker and data schemas separately.
2. Provision backend services and import data without exposing any secrets.
3. Run end-to-end tests for all 13 games and account/score flows on staging.
4. Create a dedicated Minute Arcade repository and move these files there before introducing a new deployment pipeline.
5. Only switch DNS after testing; preserve the currently working site until the replacement is complete.

## Prepared launch improvements (not yet deployed)

The follow-up commit adds canonical metadata, website icons, the installable-web-app manifest, robots.txt, and sitemap.xml to this GitHub branch. These are **not live** on https://minute-arcade.com until the corresponding files are published through the real Site editor or a fully tested replacement deployment. The manifest does not implement offline support. AdSense ads.txt intentionally remains absent because no verified publisher ID is available.

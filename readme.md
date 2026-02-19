diff --git a/readme.md b/readme.md
index 737f65f8c746e47100accd2e50b144670a284a33..5b4e007ad33578cabcce35b1c3788ec7e9422ffa 100644
--- a/readme.md
+++ b/readme.md
@@ -82,43 +82,90 @@ Run offline smoke validation (WebKit authoritative + Chromium best-effort fallba
 
 ```bash
 node playwright/smoke-offline.mjs
 ```
 
 
 ## Local smoke validation
 
 ```bash
 npm install
 npm run playwright:install
 npm run smoke:offline
 ```
 
 Linux CI/container runners can use:
 
 ```bash
 npm run playwright:install:deps
 ```
 
 Notes:
 - WebKit is authoritative for iPhone/Safari behavior.
 - Chromium smoke uses hardened launch flags for container stability.
 
 
+## Playwright Setup
+
+Use a deterministic setup command for local dev/CI:
+
+```bash
+npm run pw:setup
+```
+
+What it does:
+- runs `npm ci`
+- checks browser availability via `npm run pw:preflight`
+- installs browsers (`chromium`, `webkit`, `firefox`) when downloads are allowed
+- keeps smoke tests skippable when download is blocked
+
+Local commands:
+
+```bash
+npm ci
+npx playwright install --with-deps
+npm run pw:preflight
+npm run meal:smoke
+```
+
+If downloads are blocked:
+
+```bash
+PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm run pw:setup
+npm run meal:smoke
+```
+
+In this mode, smoke scripts write diagnostics and skip by default. Set `SMOKE_STRICT=1` to hard-fail when browsers are missing.
+
+CI caching guidance:
+- Cache `~/.cache/ms-playwright` (default)
+- Or set/cache `PLAYWRIGHT_BROWSERS_PATH` directory
+- Run `npm run pw:preflight` before smoke jobs to fail fast on missing binaries
+
+Meal-template artifact paths:
+- `.runtime-artifacts/meal-templates/commit-1-storage/add-entry-meals.png`
+- `.runtime-artifacts/meal-templates/commit-1-storage/meal-modal-empty.png`
+- `.runtime-artifacts/meal-templates/commit-1-storage/meal-modal-filled.png`
+- `.runtime-artifacts/meal-templates/commit-1-storage/dashboard-after-one-tap.png`
+- `.runtime-artifacts/meal-templates/commit-2-ui/add-entry-meals.png`
+- `.runtime-artifacts/meal-templates/commit-2-ui/meal-modal-empty.png`
+- `.runtime-artifacts/meal-templates/commit-2-ui/meal-modal-filled.png`
+- `.runtime-artifacts/meal-templates/commit-2-ui/dashboard-after-one-tap.png`
+
 ## Restricted environments (CDN 403)
 
 In some locked-down CI/container environments, Playwright browser downloads can be blocked (for example `403 Domain forbidden`).
 
 In that case:
 - `npm run playwright:install` prints guidance and soft-fails for recognized blocked-download errors.
 - `npm run smoke:offline` auto-skips only when browser binaries are missing.
 - Other app checks/tests continue to run normally.
 
 To run smoke tests on a local machine with download access:
 
 ```bash
 npm install
 npx playwright install
 npm run smoke:offline
 ```
 
 WebKit remains the primary/authoritative target for iPhone Safari behavior.

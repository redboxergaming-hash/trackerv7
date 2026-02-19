diff --git a/playwright/preflight.mjs b/playwright/preflight.mjs
index d2d5dae1f18a61e9fb8db00aaeec51984ea70b6b..192d389f09af487d643faac6eec17c7ac8935ed2 100644
--- a/playwright/preflight.mjs
+++ b/playwright/preflight.mjs
@@ -1,50 +1,140 @@
-import { chromiumLaunchOptions } from './config.mjs';
+import { access } from 'node:fs/promises';
+import { constants as fsConstants } from 'node:fs';
 
-function looksLikeMissingPlaywright(error) {
-  const text = String(error?.stack || error?.message || error || '');
-  return error?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package 'playwright'/i.test(text);
+function boolEnv(name) {
+  const value = process.env[name];
+  return value != null && value !== '' && value !== '0' && value.toLowerCase() !== 'false';
 }
 
-function looksLikeMissingBrowserBinary(error) {
-  const text = String(error?.stack || error?.message || error || '');
-  return /Executable doesn't exist|browserType\.launch: Executable|please run the following command to download new browsers|browser not found|failed to launch browser process/i.test(text);
+async function fileExists(path) {
+  if (!path) return false;
+  try {
+    await access(path, fsConstants.F_OK);
+    return true;
+  } catch {
+    return false;
+  }
 }
 
-async function canLaunch(name, browserType, options) {
-  const browser = await browserType.launch(options);
-  await browser.close();
-  return { name, ok: true };
+function printStatusTable(rows) {
+  const nameWidth = Math.max('Browser'.length, ...rows.map((row) => row.name.length));
+  const statusWidth = Math.max('Status'.length, ...rows.map((row) => row.status.length));
+
+  const header = `${'Browser'.padEnd(nameWidth)}  ${'Status'.padEnd(statusWidth)}  Path`;
+  const divider = `${'-'.repeat(nameWidth)}  ${'-'.repeat(statusWidth)}  ${'-'.repeat(4)}`;
+  console.log(header);
+  console.log(divider);
+  rows.forEach((row) => {
+    console.log(`${row.name.padEnd(nameWidth)}  ${row.status.padEnd(statusWidth)}  ${row.path || '(unresolved)'}`);
+  });
 }
 
-export async function playwrightPreflight() {
+function buildSummary({ ok, reason, rows, browsersPath, skipDownload, ci }) {
+  return {
+    ok,
+    reason,
+    requiredBrowsers: rows.map((row) => row.name),
+    rows,
+    env: {
+      PLAYWRIGHT_BROWSERS_PATH: browsersPath,
+      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: skipDownload,
+      CI: ci
+    },
+    installHint: 'npx playwright install --with-deps chromium webkit firefox',
+    cachingHint:
+      'Cache ~/.cache/ms-playwright or your custom PLAYWRIGHT_BROWSERS_PATH directory in CI to avoid repeated downloads.'
+  };
+}
+
+export async function playwrightPreflight({ requiredBrowsers = ['chromium', 'webkit', 'firefox'], quiet = false } = {}) {
+  const skipDownload = boolEnv('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD');
+  const ci = String(process.env.CI || '').toLowerCase() === 'true';
+  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '(default Playwright cache)';
+
   let playwright;
   try {
     playwright = await import('playwright');
   } catch (error) {
-    if (looksLikeMissingPlaywright(error)) {
-      return {
-        ok: false,
-        reason: 'playwright-missing',
-        message: 'Playwright is not installed. Run: npm i && npx playwright install'
-      };
+    return {
+      ok: false,
+      reason: 'playwright-missing',
+      message: `Playwright package is missing. Run: npm ci${skipDownload ? '' : ' && npx playwright install --with-deps'}`,
+      rows: [],
+      summary: buildSummary({ ok: false, reason: 'playwright-missing', rows: [], browsersPath, skipDownload, ci })
+    };
+  }
+
+  const rows = [];
+  for (const name of requiredBrowsers) {
+    const browserType = playwright[name];
+    if (!browserType) {
+      rows.push({ name, status: 'MISSING', path: '(unsupported browser type)' });
+      continue;
+    }
+
+    let resolvedPath = '';
+    try {
+      resolvedPath = browserType.executablePath();
+    } catch {
+      resolvedPath = '';
     }
-    throw error;
+
+    const found = await fileExists(resolvedPath);
+    rows.push({ name, status: found ? 'FOUND' : 'MISSING', path: resolvedPath || '(unresolved)' });
   }
 
-  const { chromium, webkit } = playwright;
-  try {
-    await canLaunch('webkit', webkit, { headless: true });
-    await canLaunch('chromium', chromium, chromiumLaunchOptions());
-    return { ok: true, reason: 'ready' };
-  } catch (error) {
-    if (looksLikeMissingBrowserBinary(error)) {
-      return {
-        ok: false,
-        reason: 'browser-binaries-missing',
-        message:
-          'Playwright is installed but browser binaries are missing. In restricted environments (CDN 403), installs may fail. Run this locally on your machine: npx playwright install. WebKit is authoritative for iPhone/Safari behavior.'
-      };
+  if (!quiet) {
+    console.log('Playwright preflight');
+    console.log(`- PLAYWRIGHT_BROWSERS_PATH: ${browsersPath}`);
+    console.log(`- PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: ${skipDownload ? '1' : '0'}`);
+    console.log(`- CI: ${ci ? 'true' : 'false'}`);
+    printStatusTable(rows);
+  }
+
+  const missing = rows.filter((row) => row.status !== 'FOUND');
+  if (!missing.length) {
+    if (!quiet) console.log('Preflight OK: required browser binaries are present.');
+    return {
+      ok: true,
+      reason: 'ready',
+      rows,
+      message: 'All required browser binaries are present.',
+      summary: buildSummary({ ok: true, reason: 'ready', rows, browsersPath, skipDownload, ci })
+    };
+  }
+
+  const installHint = skipDownload
+    ? 'Browser download is disabled (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1). Unset it and run: npx playwright install --with-deps chromium webkit firefox'
+    : 'Install missing browsers with: npx playwright install --with-deps chromium webkit firefox';
+
+  const message = `Missing Playwright browser binaries: ${missing.map((row) => row.name).join(', ')}. ${installHint}`;
+  if (!quiet) {
+    console.warn(message);
+    if (ci) {
+      console.warn(
+        'CI tip: cache ~/.cache/ms-playwright (or PLAYWRIGHT_BROWSERS_PATH) and run preflight before smoke tests.'
+      );
     }
-    throw error;
   }
+
+  return {
+    ok: false,
+    reason: 'browser-binaries-missing',
+    rows,
+    message,
+    summary: buildSummary({ ok: false, reason: 'browser-binaries-missing', rows, browsersPath, skipDownload, ci })
+  };
+}
+
+if (import.meta.url === `file://${process.argv[1]}`) {
+  const result = await playwrightPreflight();
+  if (result.ok) {
+    process.exit(0);
+  }
+
+  if (result.reason === 'browser-binaries-missing') {
+    process.exit(2);
+  }
+
+  process.exit(1);
 }

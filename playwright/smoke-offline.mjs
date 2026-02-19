diff --git a/playwright/smoke-offline.mjs b/playwright/smoke-offline.mjs
index 83d2909e63e39e53cd2cdd4e7a72d587448eb5c1..da6cb5d2490d68ff0803377d111f3d079b465297 100644
--- a/playwright/smoke-offline.mjs
+++ b/playwright/smoke-offline.mjs
@@ -46,42 +46,42 @@ async function runChromiumOfflineCheck(chromium) {
     page.on('console', (msg) => {
       if (msg.type() === 'error') errors.push(msg.text());
     });
 
     await page.goto(baseUrl, { waitUntil: 'networkidle' });
     await context.setOffline(true);
     await page.click('button[data-route="analytics"]');
     await page.fill('#analyticsWeightDate', '2026-01-25');
     await page.fill('#analyticsWeightInput', '79.3');
     await page.click('#saveWeightLogBtn');
     await page.waitForTimeout(700);
     const topItem = await page.locator('#weightLogList li').first().innerText();
 
     console.log('CHROMIUM_OFFLINE_TOP_ITEM', topItem);
     console.log('CHROMIUM_ERROR_COUNT', errors.length);
     await browser.close();
   } catch (error) {
     if (isChromiumCrashError(error)) {
       console.warn('Chromium crashed in this environment (SIGSEGV). WebKit offline run is authoritative and already passed.');
       return;
     }
     throw error;
   }
 }
 
-const preflight = await playwrightPreflight();
+const preflight = await playwrightPreflight({ requiredBrowsers: ['webkit', 'chromium'] });
 if (!preflight.ok) {
   if (preflight.reason === 'browser-binaries-missing') {
     console.warn('Skipping Playwright smoke-offline: browser binaries not installed (likely blocked download / CDN 403).');
     console.warn(preflight.message);
     process.exit(0);
   }
 
   if (preflight.reason === 'playwright-missing') {
     console.error(preflight.message);
     process.exit(1);
   }
 }
 
 const { chromium, webkit } = await import('playwright');
 await runWebkitChecks(webkit);
 await runChromiumOfflineCheck(chromium);

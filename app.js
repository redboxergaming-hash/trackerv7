diff --git a/app.js b/app.js
index 3dd87bcc399fb64f3cf9862027f233374ca4b787..9354d3a43f41540fe6df63be08dc707a665de680 100644
--- a/app.js
+++ b/app.js
@@ -1,81 +1,99 @@
 import { genericFoods } from './genericfoods.js';
 import { computeNutritionFromPer100g } from './math.js';
 import { lookupOpenFoodFacts } from './offclient.js';
 import { startBarcodeScanner, stopBarcodeScanner } from './scanner.js';
 import { drawWeeklyAnalyticsChart } from './analyticschart.js';
 import {
   addEntry,
   deleteAllData,
   deletePersonCascade,
   exportAllData,
   getCachedProduct,
   getEntriesForPersonDate,
   getLoggedDatesByPerson,
   getFavorites,
   getLastPortion,
   getPersons,
   getRecents,
   getWeightLogsByPerson,
   getWeightLogsInRange,
   addWeightLog,
   upsertCachedProduct,
   importAllData,
   isFavorite,
   seedSampleData,
   toggleFavorite,
-  upsertPerson
+  upsertPerson,
+  getMealTemplates,
+  upsertMealTemplate,
+  logMealTemplate,
+  getMealTemplate,
+  deleteMealTemplate,
+  addWaterLog,
+  addExerciseLog,
+  getWaterTotalForPersonDate,
+  getExerciseTotalForPersonDate,
+  getMetaValue,
+  setMetaValue
 } from './storage.js';
 import {
   closePortionDialog,
   fillPersonForm,
   initRoutes,
   openPortionDialog,
   readPersonForm,
   readPortionGrams,
   renderDashboard,
   renderDashboardEmpty,
   renderPersonPicker,
   renderPersonsList,
   renderPortionPicker,
   renderSettingsPersons,
   renderSuggestions,
   renderFavoriteSection,
   renderRecentSection,
   renderScanResult,
   setPortionGrams,
   setScanStatus,
   showAddStatus,
   readAnalyticsWeightForm,
   renderAnalyticsPersonPicker,
   setAnalyticsDefaultDate,
   renderWeightLogList,
   setAnalyticsStatus,
   renderAnalyticsInsights,
   renderNutritionPersonPicker,
   setNutritionDefaultDate,
-  renderNutritionOverview
+  renderNutritionOverview,
+  renderMealTemplates,
+  renderMealTemplateItems,
+  renderMealTemplateSearchResults,
+  openMealTemplateDialog,
+  closeMealTemplateDialog,
+  renderSettingsDashboardLayout,
+  readSettingsDashboardLayout
 } from './ui.js';
 
 const CHATGPT_PHOTO_PROMPT = `Look at this meal photo. List the foods you can clearly identify.
 If uncertain, ask clarifying questions.
 Do NOT guess portion sizes.
 Ask me for grams or pieces for each item.
 Also ask whether oil, butter, or sauce was used.
 Output as a checklist.`;
 
 
 const IOS_INSTALL_BANNER_DISMISSED_KEY = 'iosInstallBannerDismissed';
 
 function isStandaloneMode() {
   return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
 }
 
 function isIosDevice() {
   return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
 }
 
 function renderIosInstallBanner() {
   const banner = document.getElementById('iosInstallBanner');
   if (!banner) return;
 
   const dismissed = window.localStorage.getItem(IOS_INSTALL_BANNER_DISMISSED_KEY) === '1';
@@ -122,64 +140,108 @@ async function loadNutritionOverview() {
       const value = Number(entry?.[nutrient.key]);
       if (!Number.isFinite(value)) return sum;
       hasValue = true;
       return sum + value;
     }, 0);
 
     const targetRaw = Number(person?.micronutrientTargets?.[nutrient.key]);
     const target = Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null;
     const safeAmount = hasValue ? Math.round(amount * 1000) / 1000 : null;
     const percent = target && safeAmount !== null ? Math.round((safeAmount / target) * 1000) / 10 : null;
 
     return {
       key: nutrient.key,
       label: nutrient.label,
       unit: nutrient.unit,
       amount: safeAmount,
       target,
       percent
     };
   });
 
   const hasAnyData = rows.some((row) => row.amount !== null);
   renderNutritionOverview(rows, hasAnyData);
 }
 
+
+const DASHBOARD_LAYOUT_DEFAULT = {
+  order: ['calories', 'macros', 'streak', 'habits', 'macroBreakdown'],
+  hidden: { calories: false, macros: false, streak: false, habits: false, macroBreakdown: false }
+};
+
+function normalizeDashboardLayout(layout) {
+  const baseOrder = [...DASHBOARD_LAYOUT_DEFAULT.order];
+  const incomingOrder = Array.isArray(layout?.order) ? layout.order : [];
+  const order = [];
+  incomingOrder.forEach((key) => {
+    if (baseOrder.includes(key) && !order.includes(key)) order.push(key);
+  });
+  baseOrder.forEach((key) => {
+    if (!order.includes(key)) order.push(key);
+  });
+
+  const hidden = {};
+  baseOrder.forEach((key) => {
+    hidden[key] = Boolean(layout?.hidden?.[key]);
+  });
+
+  return { order, hidden };
+}
+
+function moveDashboardCard(layout, key, direction) {
+  const idx = layout.order.indexOf(key);
+  if (idx < 0) return layout;
+  const next = idx + direction;
+  if (next < 0 || next >= layout.order.length) return layout;
+  const order = [...layout.order];
+  [order[idx], order[next]] = [order[next], order[idx]];
+  return { ...layout, order };
+}
+
+function getDashboardLayoutMetaKey(personId) {
+  return personId ? `dashboardLayout:${personId}` : null;
+}
+
 const state = {
   route: 'persons',
   persons: [],
   selectedPersonId: null,
   selectedDate: new Date().toISOString().slice(0, 10),
   suggestions: [],
   favoritesByPerson: {},
   recentsByPerson: {},
   activeFood: null,
   scannedProduct: null,
   analyticsRange: '1W',
   analyticsPoints: [],
   selectedGenericCategory: 'All',
-  dashboardMacroView: 'consumed'
+  dashboardMacroView: 'consumed',
+  mealTemplates: [],
+  mealTemplateDraft: { id: null, name: '', items: [] },
+  mealTemplatePickerOpen: false,
+  dashboardLayoutByPerson: {},
+  settingsDashboardLayoutDraft: normalizeDashboardLayout(DASHBOARD_LAYOUT_DEFAULT)
 };
 
 function foodFromGeneric(item) {
   return {
     foodId: item.id,
     label: item.name,
     nutrition: { kcal100g: item.kcal100g, p100g: item.p100g, c100g: item.c100g, f100g: item.f100g },
     pieceGramHint: item.pieceGramHint,
     sourceType: 'generic',
     isGeneric: true,
     groupLabel: `Built-in generic • ${item.category || 'Uncategorized'}`
   };
 }
 
 
 function startOfDayUtc(date) {
   return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
 }
 
 function toIsoDate(date) {
   return date.toISOString().slice(0, 10);
 }
 
 function addDays(isoDate, days) {
   const d = new Date(`${isoDate}T00:00:00Z`);
@@ -397,88 +459,144 @@ async function handleSaveWeightLog() {
   setAnalyticsStatus(`Saved ${scaleWeight} kg on ${date}.`);
   await loadAnalytics();
   await loadNutritionOverview();
 }
 
 async function loadAndRender() {
   state.persons = await getPersons();
   normalizeSelection();
   await loadPersonScopedCaches();
 
   document.getElementById('datePicker').value = state.selectedDate;
   document.getElementById('addTime').value = document.getElementById('addTime').value || nowTime();
 
   const entriesByPerson = {};
   for (const person of state.persons) {
     entriesByPerson[person.id] = await getEntriesForPersonDate(person.id, state.selectedDate);
   }
 
   renderPersonsList(state.persons, getTotalsByPerson(entriesByPerson));
   renderPersonPicker(state.persons, state.selectedPersonId);
   renderAnalyticsPersonPicker(state.persons, state.selectedPersonId);
   setAnalyticsDefaultDate(state.selectedDate);
   renderNutritionPersonPicker(state.persons, state.selectedPersonId);
   setNutritionDefaultDate(state.selectedDate);
   renderSettingsPersons(state.persons);
+
+  const layoutPersonId = state.selectedPersonId || state.persons[0]?.id || null;
+  if (layoutPersonId && !state.dashboardLayoutByPerson[layoutPersonId]) {
+    const savedLayout = await getMetaValue(getDashboardLayoutMetaKey(layoutPersonId));
+    state.dashboardLayoutByPerson[layoutPersonId] = normalizeDashboardLayout(savedLayout || DASHBOARD_LAYOUT_DEFAULT);
+  }
+  state.settingsDashboardLayoutDraft = normalizeDashboardLayout(
+    layoutPersonId ? state.dashboardLayoutByPerson[layoutPersonId] : DASHBOARD_LAYOUT_DEFAULT
+  );
+  renderSettingsDashboardLayout(state.settingsDashboardLayoutDraft, handleMoveDashboardLayoutItem);
+
   document.querySelectorAll('#genericCategoryFilters button[data-category]').forEach((btn) => {
     btn.classList.toggle('active', btn.dataset.category === state.selectedGenericCategory);
   });
 
+  state.mealTemplates = await getMealTemplates();
+  renderMealTemplates(state.mealTemplates);
+
   const person = state.persons.find((p) => p.id === state.selectedPersonId);
   if (person) {
     const streakDays = await computeLoggingStreakDays(person.id, state.selectedDate);
+    const waterMl = await getWaterTotalForPersonDate(person.id, state.selectedDate);
+    const exerciseMinutes = await getExerciseTotalForPersonDate(person.id, state.selectedDate);
     renderDashboard(person, state.selectedDate, entriesByPerson[person.id] || [], {
       macroView: state.dashboardMacroView,
-      streakDays
+      streakDays,
+      habits: {
+        waterMl,
+        exerciseMinutes,
+        waterGoalMl: Number.isFinite(Number(person.waterGoalMl)) ? Number(person.waterGoalMl) : 2000,
+        exerciseGoalMinutes: Number.isFinite(Number(person.exerciseGoalMin)) ? Number(person.exerciseGoalMin) : 30,
+        canLog: Boolean(person.id)
+      },
+      layout: state.dashboardLayoutByPerson[person.id] || DASHBOARD_LAYOUT_DEFAULT
     });
     filterSuggestions(document.getElementById('foodSearchInput').value || '', person.id);
   } else {
     renderDashboardEmpty();
   }
 
   await loadAnalytics();
   await loadNutritionOverview();
 }
 
 async function handlePersonSave(e) {
   e.preventDefault();
   const person = readPersonForm();
   if (!person.name) {
     window.alert('Please provide a name.');
     return;
   }
   if (!Number.isFinite(person.kcalGoal) || person.kcalGoal < 800) {
     window.alert('Please provide a valid daily kcal goal (>= 800).');
     return;
   }
 
+  person.waterGoalMl = Number.isFinite(Number(person.waterGoalMl)) ? Number(person.waterGoalMl) : 2000;
+  person.exerciseGoalMin = Number.isFinite(Number(person.exerciseGoalMin)) ? Number(person.exerciseGoalMin) : 30;
+
   await upsertPerson(person);
   state.selectedPersonId = person.id;
   fillPersonForm(null);
   await loadAndRender();
 }
 
+
+function handleMoveDashboardLayoutItem(cardKey, direction) {
+  state.settingsDashboardLayoutDraft = moveDashboardCard(state.settingsDashboardLayoutDraft, cardKey, direction);
+  renderSettingsDashboardLayout(state.settingsDashboardLayoutDraft, handleMoveDashboardLayoutItem);
+}
+
+async function handleSaveDashboardLayout() {
+  const personId = state.selectedPersonId || state.persons[0]?.id;
+  if (!personId) {
+    showSettingsDataStatus('Create/select a person first.');
+    return;
+  }
+
+  const input = readSettingsDashboardLayout();
+  const nextLayout = normalizeDashboardLayout({
+    ...state.settingsDashboardLayoutDraft,
+    hidden: {
+      ...state.settingsDashboardLayoutDraft.hidden,
+      ...input.hidden
+    }
+  });
+
+  await setMetaValue(getDashboardLayoutMetaKey(personId), nextLayout);
+  state.dashboardLayoutByPerson[personId] = nextLayout;
+  state.settingsDashboardLayoutDraft = normalizeDashboardLayout(nextLayout);
+  showSettingsDataStatus('Dashboard layout saved.');
+  await loadAndRender();
+}
+
 async function handleSettingsActions(e) {
   const button = e.target.closest('button[data-action]');
   if (!button) return;
 
   const personId = button.dataset.personId;
   const action = button.dataset.action;
   const person = state.persons.find((p) => p.id === personId);
   if (!person) return;
 
   if (action === 'edit-person') {
     fillPersonForm(person);
     document.getElementById('personName').focus();
     return;
   }
 
   if (action === 'delete-person') {
     const ok = window.confirm(`Delete ${person.name}? This will permanently delete all their entries.`);
     if (!ok) return;
     await deletePersonCascade(person.id);
     if (state.selectedPersonId === person.id) state.selectedPersonId = null;
     fillPersonForm(null);
     await loadAndRender();
   }
 }
 
@@ -746,51 +864,209 @@ function setPhotoStatus(message) {
 }
 
 async function handleCopyPhotoPrompt() {
   try {
     await navigator.clipboard.writeText(CHATGPT_PHOTO_PROMPT);
     setPhotoStatus('Prompt copied. Open ChatGPT, upload the photo, paste prompt, then return to log manually.');
   } catch (error) {
     console.error(error);
     setPhotoStatus('Could not copy automatically. Please copy the prompt manually.');
   }
 }
 
 function handlePhotoSelected(file) {
   if (!file) return;
   const preview = document.getElementById('photoPreview');
   const reader = new FileReader();
   reader.onload = () => {
     preview.src = reader.result;
     preview.hidden = false;
     setPhotoStatus('Photo preview ready. Use “Copy ChatGPT Prompt” and follow instructions below.');
   };
   reader.readAsDataURL(file);
 }
 
 
+function mealItemFromSuggestion(item) {
+  return {
+    foodKey: item.foodId,
+    label: item.label,
+    per100g: {
+      kcal: Number(item.nutrition?.kcal100g || 0),
+      protein: Number(item.nutrition?.p100g || 0),
+      carbs: Number(item.nutrition?.c100g || 0),
+      fat: Number(item.nutrition?.f100g || 0)
+    },
+    gramsDefault: 100
+  };
+}
+
+function mealTemplateSuggestionPool(personId) {
+  return buildSuggestionPool(personId, state.selectedGenericCategory);
+}
+
+function renderMealTemplateDraft() {
+  const picker = document.getElementById('mealTemplatePicker');
+  picker.hidden = !state.mealTemplatePickerOpen;
+  document.getElementById('mealTemplateName').value = state.mealTemplateDraft.name || '';
+  renderMealTemplateItems(state.mealTemplateDraft.items || []);
+  if (state.mealTemplatePickerOpen) {
+    const personId = document.getElementById('addPersonPicker').value || state.selectedPersonId;
+    const pool = personId ? mealTemplateSuggestionPool(personId) : [];
+    const query = (document.getElementById('mealTemplateSearchInput').value || '').trim().toLowerCase();
+    const filtered = query ? pool.filter((item) => item.label.toLowerCase().includes(query)) : pool;
+    renderMealTemplateSearchResults(filtered.slice(0, 30));
+  }
+}
+
+function resetMealTemplateDraft() {
+  state.mealTemplateDraft = { id: null, name: '', items: [] };
+  state.mealTemplatePickerOpen = false;
+  const search = document.getElementById('mealTemplateSearchInput');
+  if (search) search.value = '';
+}
+
+function openNewMealTemplateDialog() {
+  resetMealTemplateDraft();
+  openMealTemplateDialog();
+  renderMealTemplateDraft();
+}
+
+async function handleSaveMealTemplate(e) {
+  e.preventDefault();
+  const name = (document.getElementById('mealTemplateName').value || '').trim();
+  if (!name) {
+    window.alert('Please provide a meal name.');
+    return;
+  }
+  if (!(state.mealTemplateDraft.items || []).length) {
+    window.alert('Please add at least one item.');
+    return;
+  }
+
+  const items = state.mealTemplateDraft.items.map((item) => {
+    const grams = Number(item.gramsDefault);
+    return {
+      ...item,
+      gramsDefault: Number.isFinite(grams) && grams > 0 ? grams : 100
+    };
+  });
+
+  await upsertMealTemplate({
+    id: state.mealTemplateDraft.id || undefined,
+    name,
+    items
+  });
+
+  closeMealTemplateDialog();
+  resetMealTemplateDraft();
+  showAddStatus(`Saved meal template “${name}”.`);
+  await loadAndRender();
+}
+
+async function handleLogMealTemplate(templateId) {
+  const personId = document.getElementById('addPersonPicker').value || state.selectedPersonId;
+  if (!personId) {
+    window.alert('Create/select a person first.');
+    return;
+  }
+  const date = state.selectedDate;
+  const time = document.getElementById('addTime').value || nowTime();
+  const summary = await logMealTemplate({ personId, date, time, templateId });
+  showAddStatus(`Logged ${summary.count} meal items (${Math.round(summary.totalKcal)} kcal).`);
+  await loadAndRender();
+}
+
+
+async function openEditMealTemplateDialog(templateId) {
+  const template = await getMealTemplate(templateId);
+  if (!template) {
+    window.alert('Meal template not found.');
+    return;
+  }
+
+  state.mealTemplateDraft = {
+    id: template.id,
+    name: template.name,
+    items: (template.items || []).map((item) => ({
+      foodKey: item.foodKey,
+      label: item.label,
+      per100g: { ...item.per100g },
+      gramsDefault: item.gramsDefault
+    }))
+  };
+  state.mealTemplatePickerOpen = false;
+  const search = document.getElementById('mealTemplateSearchInput');
+  if (search) search.value = '';
+
+  openMealTemplateDialog();
+  renderMealTemplateDraft();
+}
+
+async function handleDuplicateMealTemplate(templateId) {
+  const template = await getMealTemplate(templateId);
+  if (!template) {
+    window.alert('Meal template not found.');
+    return;
+  }
+
+  const suffix = ' (copy)';
+  const baseName = String(template.name || 'Meal').trim();
+  const maxBaseLen = Math.max(1, 40 - suffix.length);
+  const copyName = `${baseName.slice(0, maxBaseLen)}${suffix}`;
+
+  await upsertMealTemplate({
+    name: copyName,
+    items: (template.items || []).map((item) => ({
+      foodKey: item.foodKey,
+      label: item.label,
+      per100g: { ...item.per100g },
+      gramsDefault: item.gramsDefault
+    }))
+  });
+
+  showAddStatus(`Duplicated meal template as “${copyName}”.`);
+  await loadAndRender();
+}
+
+async function handleDeleteMealTemplate(templateId) {
+  const template = await getMealTemplate(templateId);
+  if (!template) {
+    window.alert('Meal template not found.');
+    return;
+  }
+
+  const ok = window.confirm(`Delete meal template “${template.name}”?`);
+  if (!ok) return;
+
+  await deleteMealTemplate(templateId);
+  showAddStatus('Meal template deleted.');
+  await loadAndRender();
+}
+
 async function registerServiceWorker() {
+
   if (!('serviceWorker' in navigator)) return;
   try {
     await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
   } catch (error) {
     console.error('Service worker registration failed:', error);
   }
 }
 
 function wireEvents() {
   initRoutes((route) => {
     state.route = route;
     if (route !== 'scan') {
       stopBarcodeScanner();
     }
   });
 
   document.getElementById('personPicker').addEventListener('change', async (e) => {
     state.selectedPersonId = e.target.value || null;
     await loadAndRender();
   });
 
   document.getElementById('analyticsPersonPicker').addEventListener('change', async () => {
     await loadAnalytics();
   });
 
@@ -806,124 +1082,242 @@ function wireEvents() {
     await loadAnalytics();
   });
 
   document.getElementById('analyticsRangeToggle').addEventListener('click', async (e) => {
     const btn = e.target.closest('button[data-range]');
     if (!btn) return;
     state.analyticsRange = btn.dataset.range || '1W';
     await loadAnalytics();
   });
 
   document.getElementById('saveWeightLogBtn').addEventListener('click', async () => {
     try {
       await handleSaveWeightLog();
     } catch (error) {
       console.error(error);
       setAnalyticsStatus('Could not save weight log.');
     }
   });
 
   document.getElementById('datePicker').addEventListener('change', async (e) => {
     state.selectedDate = e.target.value;
     await loadAndRender();
   });
 
   document.getElementById('dashboardSummary').addEventListener('click', async (e) => {
+    const habitBtn = e.target.closest('button[data-action]');
+    if (habitBtn) {
+      const personId = state.selectedPersonId;
+      if (!personId) {
+        window.alert('Create/select a person first.');
+        return;
+      }
+      const action = habitBtn.dataset.action;
+      if (action === 'add-water-250' || action === 'add-water-500') {
+        const amountMl = action === 'add-water-250' ? 250 : 500;
+        await addWaterLog({ personId, date: state.selectedDate, amountMl });
+        await loadAndRender();
+        return;
+      }
+      if (action === 'add-exercise-10' || action === 'add-exercise-20') {
+        const minutes = action === 'add-exercise-10' ? 10 : 20;
+        await addExerciseLog({ personId, date: state.selectedDate, minutes });
+        await loadAndRender();
+        return;
+      }
+    }
+
     const btn = e.target.closest('button[data-macro-view]');
     if (!btn) return;
     const view = btn.dataset.macroView;
     if (!view || !['consumed', 'remaining', 'percent'].includes(view)) return;
     state.dashboardMacroView = view;
     await loadAndRender();
   });
 
   document.getElementById('addPersonPicker').addEventListener('change', async (e) => {
     state.selectedPersonId = e.target.value || null;
+    const personId = state.selectedPersonId || state.persons[0]?.id || null;
+    if (personId && !state.dashboardLayoutByPerson[personId]) {
+      const savedLayout = await getMetaValue(getDashboardLayoutMetaKey(personId));
+      state.dashboardLayoutByPerson[personId] = normalizeDashboardLayout(savedLayout || DASHBOARD_LAYOUT_DEFAULT);
+    }
+    state.settingsDashboardLayoutDraft = normalizeDashboardLayout(
+      personId ? state.dashboardLayoutByPerson[personId] : DASHBOARD_LAYOUT_DEFAULT
+    );
     await loadAndRender();
   });
 
   document.getElementById('genericCategoryFilters').addEventListener('click', (e) => {
     const btn = e.target.closest('button[data-category]');
     if (!btn) return;
     state.selectedGenericCategory = btn.dataset.category || 'All';
     const personId = document.getElementById('addPersonPicker').value || state.selectedPersonId;
     if (!personId) return;
     filterSuggestions(document.getElementById('foodSearchInput').value || '', personId);
     document.querySelectorAll('#genericCategoryFilters button[data-category]').forEach((b) => {
       b.classList.toggle('active', b === btn);
     });
   });
 
   document.getElementById('foodSearchInput').addEventListener('input', (e) => {
     const personId = document.getElementById('addPersonPicker').value || state.selectedPersonId;
     if (!personId) return;
     filterSuggestions(e.target.value, personId);
   });
 
+  document.getElementById('mealTemplatesRow').addEventListener('click', async (e) => {
+    const btn = e.target.closest('button[data-action]');
+    if (!btn) return;
+
+    if (btn.dataset.action === 'new-meal-template') {
+      openNewMealTemplateDialog();
+      return;
+    }
+
+    const templateId = btn.dataset.templateId;
+    if (!templateId) return;
+
+    if (btn.dataset.action === 'log-meal-template') {
+      await handleLogMealTemplate(templateId);
+      return;
+    }
+
+    if (btn.dataset.action === 'edit-meal-template') {
+      await openEditMealTemplateDialog(templateId);
+      return;
+    }
+
+    if (btn.dataset.action === 'duplicate-meal-template') {
+      await handleDuplicateMealTemplate(templateId);
+      return;
+    }
+
+    if (btn.dataset.action === 'delete-meal-template') {
+      await handleDeleteMealTemplate(templateId);
+    }
+  });
+
+  document.getElementById('mealTemplateAddItemBtn').addEventListener('click', () => {
+    state.mealTemplatePickerOpen = !state.mealTemplatePickerOpen;
+    renderMealTemplateDraft();
+  });
+
+  document.getElementById('mealTemplateSearchInput').addEventListener('input', () => {
+    renderMealTemplateDraft();
+  });
+
+  document.getElementById('mealTemplateSearchResults').addEventListener('click', (e) => {
+    const btn = e.target.closest('button[data-action="select-meal-item"]');
+    if (!btn) return;
+    const personId = document.getElementById('addPersonPicker').value || state.selectedPersonId;
+    if (!personId) return;
+    const selected = mealTemplateSuggestionPool(personId).find((item) => item.foodId === btn.dataset.foodId);
+    if (!selected) return;
+    state.mealTemplateDraft.items.push(mealItemFromSuggestion(selected));
+    renderMealTemplateDraft();
+  });
+
+  document.getElementById('mealTemplateItems').addEventListener('click', (e) => {
+    const btn = e.target.closest('button[data-action="remove-meal-item"]');
+    if (!btn) return;
+    const index = Number(btn.dataset.index);
+    if (!Number.isFinite(index)) return;
+    state.mealTemplateDraft.items.splice(index, 1);
+    renderMealTemplateDraft();
+  });
+
+  document.getElementById('mealTemplateItems').addEventListener('input', (e) => {
+    const input = e.target.closest('input[data-action="meal-item-grams"]');
+    if (!input) return;
+    const index = Number(input.dataset.index);
+    const grams = Number(input.value);
+    if (!Number.isFinite(index) || !state.mealTemplateDraft.items[index]) return;
+    state.mealTemplateDraft.items[index].gramsDefault = grams;
+  });
+
+  document.getElementById('mealTemplateName').addEventListener('input', (e) => {
+    state.mealTemplateDraft.name = e.target.value || '';
+  });
+
+  document.getElementById('mealTemplateForm').addEventListener('submit', handleSaveMealTemplate);
+  document.getElementById('cancelMealTemplateBtn').addEventListener('click', () => {
+    closeMealTemplateDialog();
+    resetMealTemplateDraft();
+  });
+
   document.getElementById('addSuggestions').addEventListener('click', handleAddSuggestionClick);
   document.getElementById('favoriteList').addEventListener('click', handleAddSuggestionClick);
   document.getElementById('recentList').addEventListener('click', handleAddSuggestionClick);
   document.getElementById('customFoodForm').addEventListener('submit', handleCustomFoodSubmit);
 
   document.getElementById('startScanBtn').addEventListener('click', async () => {
     const video = document.getElementById('scannerVideo');
     try {
       await startBarcodeScanner(video, handleBarcodeDetected, () => {});
       setScanStatus('Scanner active. Point camera at an EAN/UPC barcode.');
     } catch (error) {
       console.error(error);
       setScanStatus('Unable to start scanner. Check camera permission.');
     }
   });
 
   document.getElementById('stopScanBtn').addEventListener('click', () => {
     stopBarcodeScanner();
     setScanStatus('Scanner stopped.');
   });
 
   document.getElementById('scanResult').addEventListener('click', async (e) => {
     const btn = e.target.closest('#logScannedProductBtn');
     if (!btn || !state.scannedProduct) return;
     await openPortionForItem(toScannedFoodItem(state.scannedProduct));
   });
 
   document.getElementById('copyPromptBtn').addEventListener('click', handleCopyPhotoPrompt);
   document.getElementById('photoInput').addEventListener('change', (e) => {
     handlePhotoSelected(e.target.files?.[0]);
   });
 
   document.getElementById('portionPresetButtons').addEventListener('click', (e) => {
     const btn = e.target.closest('button[data-action="set-portion"]');
     if (!btn) return;
     setPortionGrams(Number(btn.dataset.grams));
   });
   document.getElementById('confirmPortionBtn').addEventListener('click', logActiveFood);
   document.getElementById('cancelPortionBtn').addEventListener('click', closePortionDialog);
 
   document.getElementById('personForm').addEventListener('submit', handlePersonSave);
   document.getElementById('cancelEditBtn').addEventListener('click', () => fillPersonForm(null));
   document.getElementById('settingsPersons').addEventListener('click', handleSettingsActions);
+  document.getElementById('saveDashboardLayoutBtn').addEventListener('click', async () => {
+    try {
+      await handleSaveDashboardLayout();
+    } catch (error) {
+      console.error(error);
+      showSettingsDataStatus('Could not save dashboard layout.');
+    }
+  });
 
   document.getElementById('exportDataBtn').addEventListener('click', async () => {
     try {
       await handleExportData();
     } catch (error) {
       console.error(error);
       showSettingsDataStatus('Export failed.');
     }
   });
 
   document.getElementById('importDataInput').addEventListener('change', async (e) => {
     try {
       await handleImportDataFile(e.target.files?.[0]);
     } catch (error) {
       console.error(error);
       window.alert('Import failed. Please check the JSON file.');
     } finally {
       e.target.value = '';
     }
   });
 
   document.getElementById('deleteAllDataBtn').addEventListener('click', async () => {
     try {
       await handleDeleteAllData();
     } catch (error) {

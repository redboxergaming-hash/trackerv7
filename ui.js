diff --git a/ui.js b/ui.js
index c62f8c3b6068881d6cb2480ff332714ada76d4b1..2c320817f2fcc06650c0202f70696653a3fda122 100644
--- a/ui.js
+++ b/ui.js
@@ -1,26 +1,27 @@
 import { clamp } from './math.js';
+import { renderMacroBreakdown } from './macroviz.js';
 
 function el(id) {
   return document.getElementById(id);
 }
 
 function safeNum(value) {
   const n = Number(value);
   return Number.isFinite(n) ? n : 0;
 }
 
 export function initRoutes(onRouteChange) {
   const tabs = document.querySelectorAll('.tab');
   tabs.forEach((tab) => {
     tab.addEventListener('click', () => {
       const route = tab.dataset.route;
       tabs.forEach((t) => t.classList.toggle('active', t === tab));
       document.querySelectorAll('.screen').forEach((screen) => {
         screen.classList.toggle('active', screen.id === `screen-${route}`);
       });
       onRouteChange(route);
     });
   });
 }
 
 function sumEntries(entries) {
@@ -122,179 +123,415 @@ export function renderPersonPicker(persons, selectedId) {
 }
 
 function renderMacroCard({ label, consumed, goal, kcalFactor, view, toneClass, personKcalGoal }) {
   const safeGoal = Number.isFinite(goal) && goal > 0 ? goal : null;
   const remaining = safeGoal != null ? Math.max(0, safeGoal - consumed) : null;
   const consumedPct = safeGoal ? Math.min(100, Math.round((consumed / safeGoal) * 100)) : 0;
   const metTarget = safeGoal ? consumed >= safeGoal : false;
 
   let valueText = `${Math.round(consumed)}g consumed`;
   if (view === 'remaining') valueText = remaining == null ? '— remaining' : `${Math.round(remaining)}g remaining`;
   if (view === 'percent') {
     const consumedKcal = consumed * kcalFactor;
     valueText = safeGoal ? `${Math.round((consumedKcal / (personKcalGoal || 1)) * 100)}% of kcal` : `${Math.round(consumedKcal)} kcal`;
   }
 
   return `<article class="macro-card ${toneClass} ${metTarget ? 'goal-met' : ''}">
     <div class="macro-card-head">
       <strong>${label}</strong>
       <span>${safeGoal ? `${Math.round(consumed)}g / ${Math.round(safeGoal)}g` : `${Math.round(consumed)}g`}</span>
     </div>
     <div class="macro-card-value">${valueText}</div>
     <div class="macro-track"><div class="macro-fill" style="width:${consumedPct}%"></div></div>
   </article>`;
 }
 
-export function renderDashboard(person, date, entries, options = {}) {
-  const totals = sumEntries(entries);
-  const consumedKcal = Math.round(totals.kcal);
-  const remainingKcal = Math.max(0, Math.round(person.kcalGoal - totals.kcal));
-  const kcalProgress = person.kcalGoal > 0 ? Math.min(100, Math.round((totals.kcal / person.kcalGoal) * 100)) : 0;
-  const macroView = options.macroView || 'consumed';
-  const streakDays = Number.isFinite(options.streakDays) ? options.streakDays : 0;
 
-  el('dashboardSummary').innerHTML = `
+function safePositive(value) {
+  const n = Number(value);
+  return Number.isFinite(n) && n > 0 ? n : 0;
+}
+
+function habitProgress(value, goal) {
+  if (!goal || goal <= 0) return 0;
+  return Math.max(0, Math.min(1, value / goal));
+}
+
+function createHabitCard({
+  title,
+  valueText,
+  progress,
+  actions,
+  disabled
+}) {
+  const card = document.createElement('article');
+
+  const titleEl = document.createElement('strong');
+  titleEl.textContent = title;
+
+  const valueEl = document.createElement('p');
+  valueEl.className = 'muted tiny';
+  valueEl.textContent = valueText;
+
+  const progressEl = document.createElement('progress');
+  progressEl.max = 1;
+  progressEl.value = progress;
+
+  const actionRow = document.createElement('div');
+  actionRow.className = 'row-actions habit-actions';
+  actions.forEach((action) => {
+    const btn = document.createElement('button');
+    btn.type = 'button';
+    btn.className = 'secondary';
+    btn.dataset.action = action.action;
+    btn.textContent = action.label;
+    btn.disabled = Boolean(disabled);
+    actionRow.appendChild(btn);
+  });
+
+  card.append(titleEl, valueEl, progressEl, actionRow);
+  return card;
+}
+
+function renderDashboardHabits(container, habits) {
+  if (!container) return;
+  container.innerHTML = '';
+
+  const waterMl = safePositive(habits?.waterMl);
+  const waterGoalMl = safePositive(habits?.waterGoalMl || 2000);
+  const exerciseMinutes = safePositive(habits?.exerciseMinutes);
+  const exerciseGoalMinutes = safePositive(habits?.exerciseGoalMinutes || 30);
+  const disabled = !habits?.canLog;
+
+  const waterCard = createHabitCard({
+    title: 'Water',
+    valueText: `${Math.round(waterMl)} ml / ${Math.round(waterGoalMl)} ml`,
+    progress: habitProgress(waterMl, waterGoalMl),
+    actions: [
+      { action: 'add-water-250', label: '+250 ml' },
+      { action: 'add-water-500', label: '+500 ml' }
+    ],
+    disabled
+  });
+
+  const exerciseCard = createHabitCard({
+    title: 'Exercise',
+    valueText: `${Math.round(exerciseMinutes)} min / ${Math.round(exerciseGoalMinutes)} min`,
+    progress: habitProgress(exerciseMinutes, exerciseGoalMinutes),
+    actions: [
+      { action: 'add-exercise-10', label: '+10 min' },
+      { action: 'add-exercise-20', label: '+20 min' }
+    ],
+    disabled
+  });
+
+  container.append(waterCard, exerciseCard);
+  if (disabled) {
+    const hint = document.createElement('p');
+    hint.className = 'muted tiny';
+    hint.textContent = 'Select a person to log water and exercise.';
+    container.appendChild(hint);
+  }
+}
+
+const DASHBOARD_CARD_LABELS = {
+  calories: 'Calories',
+  macros: 'Macros',
+  streak: 'Logging streak',
+  habits: 'Healthy Habits',
+  macroBreakdown: 'Macro Breakdown'
+};
+
+const DASHBOARD_DEFAULT_ORDER = ['calories', 'macros', 'streak', 'habits', 'macroBreakdown'];
+
+function normalizeDashboardLayout(layout) {
+  const incomingOrder = Array.isArray(layout?.order) ? layout.order : [];
+  const deduped = [];
+  incomingOrder.forEach((key) => {
+    if (DASHBOARD_DEFAULT_ORDER.includes(key) && !deduped.includes(key)) deduped.push(key);
+  });
+  DASHBOARD_DEFAULT_ORDER.forEach((key) => {
+    if (!deduped.includes(key)) deduped.push(key);
+  });
+
+  const hidden = {};
+  DASHBOARD_DEFAULT_ORDER.forEach((key) => {
+    hidden[key] = Boolean(layout?.hidden?.[key]);
+  });
+
+  return { order: deduped, hidden };
+}
+
+function renderDashboardCardByKey(key, context) {
+  if (key === 'calories') {
+    return `
     <section class="dashboard-hero">
       <article class="hero-card hero-calories">
         <h3>Calories consumed</h3>
-        <p class="hero-value">${consumedKcal}</p>
-        <p class="muted tiny">Goal ${person.kcalGoal} kcal</p>
-        <div class="macro-track"><div class="macro-fill" style="width:${kcalProgress}%"></div></div>
+        <p class="hero-value">${context.consumedKcal}</p>
+        <p class="muted tiny">Goal ${context.person.kcalGoal} kcal</p>
+        <div class="macro-track"><div class="macro-fill" style="width:${context.kcalProgress}%"></div></div>
       </article>
-      <article class="hero-card hero-remaining ${remainingKcal <= 0 ? 'goal-met' : ''}">
+      <article class="hero-card hero-remaining ${context.remainingKcal <= 0 ? 'goal-met' : ''}">
         <h3>Calories remaining</h3>
-        <p class="hero-value">${remainingKcal}</p>
-        <p class="muted tiny">${remainingKcal <= 0 ? 'Daily target reached' : 'Keep going'}</p>
+        <p class="hero-value">${context.remainingKcal}</p>
+        <p class="muted tiny">${context.remainingKcal <= 0 ? 'Daily target reached' : 'Keep going'}</p>
       </article>
-    </section>
+    </section>`;
+  }
 
+  if (key === 'macros') {
+    return `
     <section class="dashboard-macros">
       <div class="row-actions macro-view-toggle" role="group" aria-label="Macro display mode">
-        <button type="button" class="secondary ${macroView === 'consumed' ? 'active' : ''}" data-macro-view="consumed">Consumed (g)</button>
-        <button type="button" class="secondary ${macroView === 'remaining' ? 'active' : ''}" data-macro-view="remaining">Remaining (g)</button>
-        <button type="button" class="secondary ${macroView === 'percent' ? 'active' : ''}" data-macro-view="percent">% Calories</button>
+        <button type="button" class="secondary ${context.macroView === 'consumed' ? 'active' : ''}" data-macro-view="consumed">Consumed (g)</button>
+        <button type="button" class="secondary ${context.macroView === 'remaining' ? 'active' : ''}" data-macro-view="remaining">Remaining (g)</button>
+        <button type="button" class="secondary ${context.macroView === 'percent' ? 'active' : ''}" data-macro-view="percent">% Calories</button>
       </div>
       <div class="macro-grid">
-        ${renderMacroCard({ label: 'Protein', consumed: totals.p, goal: person.macroTargets?.p, kcalFactor: 4, view: macroView, toneClass: 'macro-protein', personKcalGoal: person.kcalGoal })}
-        ${renderMacroCard({ label: 'Carbs', consumed: totals.c, goal: person.macroTargets?.c, kcalFactor: 4, view: macroView, toneClass: 'macro-carbs', personKcalGoal: person.kcalGoal })}
-        ${renderMacroCard({ label: 'Fat', consumed: totals.f, goal: person.macroTargets?.f, kcalFactor: 9, view: macroView, toneClass: 'macro-fat', personKcalGoal: person.kcalGoal })}
+        ${renderMacroCard({ label: 'Protein', consumed: context.totals.p, goal: context.person.macroTargets?.p, kcalFactor: 4, view: context.macroView, toneClass: 'macro-protein', personKcalGoal: context.person.kcalGoal })}
+        ${renderMacroCard({ label: 'Carbs', consumed: context.totals.c, goal: context.person.macroTargets?.c, kcalFactor: 4, view: context.macroView, toneClass: 'macro-carbs', personKcalGoal: context.person.kcalGoal })}
+        ${renderMacroCard({ label: 'Fat', consumed: context.totals.f, goal: context.person.macroTargets?.f, kcalFactor: 9, view: context.macroView, toneClass: 'macro-fat', personKcalGoal: context.person.kcalGoal })}
       </div>
-    </section>
+    </section>`;
+  }
 
+  if (key === 'macroBreakdown') {
+    return `
+    <article class="card macro-breakdown-card">
+      <h3>Macro breakdown</h3>
+      <div id="macroBreakdownViz" class="macro-breakdown-wrap"></div>
+    </article>`;
+  }
+
+  if (key === 'streak') {
+    return `
     <section class="streak-card">
       <h3>Logging streak</h3>
-      <p><strong>${streakDays} day${streakDays === 1 ? '' : 's'}</strong> in a row</p>
-      <div class="macro-track"><div class="macro-fill" style="width:${Math.min(100, streakDays * 10)}%"></div></div>
-    </section>
+      <p><strong>${context.streakDays} day${context.streakDays === 1 ? '' : 's'}</strong> in a row</p>
+      <div class="macro-track"><div class="macro-fill" style="width:${Math.min(100, context.streakDays * 10)}%"></div></div>
+    </section>`;
+  }
 
+  if (key === 'habits') {
+    return `
     <section class="habits-card">
       <h3>Healthy Habits</h3>
-      <div class="habit-grid">
-        <article>
-          <strong>Water</strong>
-          <p class="muted tiny">Placeholder: water tracking coming soon.</p>
-        </article>
-        <article>
-          <strong>Exercise</strong>
-          <p class="muted tiny">Placeholder: exercise tracking coming soon.</p>
-        </article>
-      </div>
-    </section>
+      <div id="dashboardHabits" class="habit-grid"></div>
+    </section>`;
+  }
+
+  return '';
+}
+
+export function renderDashboard(person, date, entries, options = {}) {
+  const totals = sumEntries(entries);
+  const consumedKcal = Math.round(totals.kcal);
+  const remainingKcal = Math.max(0, Math.round(person.kcalGoal - totals.kcal));
+  const kcalProgress = person.kcalGoal > 0 ? Math.min(100, Math.round((totals.kcal / person.kcalGoal) * 100)) : 0;
+  const macroView = options.macroView || 'consumed';
+  const streakDays = Number.isFinite(options.streakDays) ? options.streakDays : 0;
+  const layout = normalizeDashboardLayout(options.layout);
+
+  const context = {
+    person,
+    totals,
+    consumedKcal,
+    remainingKcal,
+    kcalProgress,
+    macroView,
+    streakDays
+  };
+
+  const visibleCards = layout.order.filter((key) => !layout.hidden[key]);
+  const sectionsHtml = visibleCards.map((key) => renderDashboardCardByKey(key, context)).join('');
+
+  el('dashboardSummary').innerHTML = `
+    ${sectionsHtml}
     <p class="muted">Date: ${date}</p>
   `;
 
+  if (visibleCards.includes('habits')) {
+    renderDashboardHabits(el('dashboardHabits'), {
+      waterMl: options.habits?.waterMl,
+      exerciseMinutes: options.habits?.exerciseMinutes,
+      waterGoalMl: options.habits?.waterGoalMl || 2000,
+      exerciseGoalMinutes: options.habits?.exerciseGoalMinutes || 30,
+      canLog: options.habits?.canLog !== false
+    });
+  }
+
+  if (visibleCards.includes('macroBreakdown')) {
+    renderMacroBreakdown(el('macroBreakdownViz'), totals);
+  }
+
   el('entriesTableContainer').innerHTML = entries.length
     ? `<table>
       <thead><tr><th>Time</th><th>Food</th><th>Amount</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>Source</th></tr></thead>
       <tbody>
       ${entries
         .map(
           (e) => `<tr>
           <td>${e.time}</td><td>${e.foodName}</td><td>${e.amountGrams}g</td><td>${e.kcal}</td><td>${e.p}</td><td>${e.c}</td><td>${e.f}</td><td>${e.source}</td>
         </tr>`
         )
         .join('')}
       </tbody>
     </table>`
     : '<p class="muted">No entries for this date.</p>';
 }
 
 export function renderDashboardEmpty() {
-  el('dashboardSummary').innerHTML = '<p class="muted">No persons available. Add a person in Settings.</p>';
+  el('dashboardSummary').innerHTML = `
+    <section class="habits-card">
+      <h3>Healthy Habits</h3>
+      <div id="dashboardHabits" class="habit-grid"></div>
+      <p class="muted tiny">No person selected. Add/select a person in Settings.</p>
+    </section>
+  `;
+  renderDashboardHabits(el('dashboardHabits'), {
+    waterMl: 0,
+    exerciseMinutes: 0,
+    waterGoalMl: 2000,
+    exerciseGoalMinutes: 30,
+    canLog: false
+  });
   el('entriesTableContainer').innerHTML = '';
 }
 
 export function renderSettingsPersons(persons) {
   const container = el('settingsPersons');
   if (!persons.length) {
     container.innerHTML = '<p class="muted">No persons yet.</p>';
     return;
   }
 
   container.innerHTML = persons
     .map(
       (p) => `<article class="settings-person-row">
       <div>
         <strong>${p.name}</strong><br />
         <span>${p.kcalGoal} kcal/day</span><br />
-        <span class="muted">P:${p.macroTargets?.p ?? '—'} C:${p.macroTargets?.c ?? '—'} F:${p.macroTargets?.f ?? '—'}</span>
+        <span class="muted">P:${p.macroTargets?.p ?? '—'} C:${p.macroTargets?.c ?? '—'} F:${p.macroTargets?.f ?? '—'}</span><br />
+        <span class="muted">Water:${p.waterGoalMl ?? 2000}ml Exercise:${p.exerciseGoalMin ?? 30}min</span>
       </div>
       <div class="settings-actions">
         <button class="secondary" data-action="edit-person" data-person-id="${p.id}">Edit</button>
         <button class="danger" data-action="delete-person" data-person-id="${p.id}">Delete</button>
       </div>
     </article>`
     )
     .join('');
 }
 
+export function renderSettingsDashboardLayout(layout, onMove) {
+  const container = el('settingsDashboardLayout');
+  if (!container) return;
+
+  const normalized = normalizeDashboardLayout(layout);
+  container.innerHTML = '';
+
+  normalized.order.forEach((key, index) => {
+    const row = document.createElement('article');
+    row.className = 'settings-dashboard-row';
+
+    const left = document.createElement('label');
+    left.className = 'settings-dashboard-toggle';
+
+    const checkbox = document.createElement('input');
+    checkbox.type = 'checkbox';
+    checkbox.dataset.cardKey = key;
+    checkbox.checked = !normalized.hidden[key];
+
+    const text = document.createElement('span');
+    text.textContent = DASHBOARD_CARD_LABELS[key] || key;
+
+    left.append(checkbox, text);
+
+    const actions = document.createElement('div');
+    actions.className = 'settings-actions';
+
+    const upBtn = document.createElement('button');
+    upBtn.type = 'button';
+    upBtn.className = 'secondary tiny-action';
+    upBtn.textContent = 'Up';
+    upBtn.disabled = index === 0;
+    upBtn.addEventListener('click', () => onMove(key, -1));
+
+    const downBtn = document.createElement('button');
+    downBtn.type = 'button';
+    downBtn.className = 'secondary tiny-action';
+    downBtn.textContent = 'Down';
+    downBtn.disabled = index === normalized.order.length - 1;
+    downBtn.addEventListener('click', () => onMove(key, 1));
+
+    actions.append(upBtn, downBtn);
+    row.append(left, actions);
+    container.appendChild(row);
+  });
+}
+
+export function readSettingsDashboardLayout() {
+  const container = el('settingsDashboardLayout');
+  const checkboxes = container ? container.querySelectorAll('input[type="checkbox"][data-card-key]') : [];
+  const hidden = {};
+  checkboxes.forEach((box) => {
+    hidden[box.dataset.cardKey] = !box.checked;
+  });
+  return { hidden };
+}
+
 export function fillPersonForm(person) {
   el('personId').value = person?.id || '';
   el('personName').value = person?.name || '';
   el('personKcalGoal').value = person?.kcalGoal || 2000;
   el('personMacroP').value = person?.macroTargets?.p ?? '';
   el('personMacroC').value = person?.macroTargets?.c ?? '';
   el('personMacroF').value = person?.macroTargets?.f ?? '';
+  el('personWaterGoalMl').value = person?.waterGoalMl ?? 2000;
+  el('personExerciseGoalMin').value = person?.exerciseGoalMin ?? 30;
   el('cancelEditBtn').hidden = !person;
 }
 
 export function readPersonForm() {
   const parseOptional = (value) => {
     if (value === '' || value === null) return null;
     const n = Number(value);
     return Number.isFinite(n) ? n : null;
   };
 
   return {
     id: el('personId').value || crypto.randomUUID(),
     name: el('personName').value.trim(),
     kcalGoal: Number(el('personKcalGoal').value),
     macroTargets: {
       p: parseOptional(el('personMacroP').value),
       c: parseOptional(el('personMacroC').value),
       f: parseOptional(el('personMacroF').value)
-    }
+    },
+    waterGoalMl: Math.max(250, Number(el('personWaterGoalMl').value) || 2000),
+    exerciseGoalMin: Math.max(5, Number(el('personExerciseGoalMin').value) || 30)
   };
 }
 
 function renderFoodList(containerId, items, favoritesSet, emptyText) {
   const wrap = el(containerId);
   if (!items.length) {
     wrap.innerHTML = `<p class="muted">${emptyText}</p>`;
     return;
   }
 
   wrap.innerHTML = items
     .map((item) => {
       const star = favoritesSet.has(item.foodId) ? '★' : '☆';
       return `<button class="suggestion" data-action="pick-food" data-food-id="${item.foodId}">
         <div>
           <strong>${item.label}</strong>
           <div class="muted tiny">${item.groupLabel}</div>
           ${item.isGeneric ? '<div class="muted tiny">Generic built-in (approx.)</div>' : ''}
         </div>
         <div class="suggestion-actions">
           <span class="star" data-action="toggle-favorite" data-food-id="${item.foodId}" role="button" aria-label="Toggle favorite">${star}</span>
         </div>
       </button>`;
     })
     .join('');
@@ -419,25 +656,206 @@ function macroValue(value) {
   return value == null ? 'missing' : `${Math.round(value * 10) / 10}`;
 }
 
 export function renderScanResult(product) {
   const wrap = el('scanResult');
   if (!product) {
     wrap.innerHTML = '';
     return;
   }
 
   wrap.innerHTML = `<article class="card">
     <div class="row-actions" style="justify-content:space-between;align-items:flex-start;">
       <div>
         <strong>${product.productName}</strong><br />
         <span class="muted">${product.brands || 'Unknown brand'}</span><br />
         <span class="muted tiny">Barcode: ${product.barcode}</span>
       </div>
       ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.productName}" width="72" height="72" style="border-radius:8px;object-fit:cover;" />` : ''}
     </div>
     <p class="muted">Per 100g — kcal: ${macroValue(product.nutrition.kcal100g)}, P: ${macroValue(product.nutrition.p100g)}, C: ${macroValue(product.nutrition.c100g)}, F: ${macroValue(product.nutrition.f100g)}</p>
     <div class="row-actions">
       <button type="button" id="logScannedProductBtn">Log via portion picker</button>
     </div>
   </article>`;
 }
+
+function macroPer100FromAny(nutrition = {}) {
+  return {
+    kcal: Number(nutrition.kcal100g),
+    protein: Number(nutrition.p100g),
+    carbs: Number(nutrition.c100g),
+    fat: Number(nutrition.f100g)
+  };
+}
+
+export function renderMealTemplates(mealTemplates = []) {
+  const wrap = el('mealTemplatesRow');
+  if (!wrap) return;
+  wrap.innerHTML = '';
+
+  const newBtn = document.createElement('button');
+  newBtn.type = 'button';
+  newBtn.className = 'secondary meal-template-card';
+  newBtn.dataset.action = 'new-meal-template';
+  const title = document.createElement('strong');
+  title.textContent = '+ New Meal';
+  const hint = document.createElement('span');
+  hint.className = 'muted tiny';
+  hint.textContent = 'Create a reusable template';
+  newBtn.append(title, hint);
+  wrap.appendChild(newBtn);
+
+  mealTemplates.forEach((template) => {
+    const totalKcal = (template.items || []).reduce((sum, item) => {
+      const grams = Number(item?.gramsDefault || 0);
+      const per100 = Number(item?.per100g?.kcal || 0);
+      if (!Number.isFinite(grams) || !Number.isFinite(per100)) return sum;
+      return sum + (grams / 100) * per100;
+    }, 0);
+
+    const card = document.createElement('div');
+    card.className = 'meal-template-card-shell';
+
+    const logBtn = document.createElement('button');
+    logBtn.type = 'button';
+    logBtn.className = 'meal-template-card';
+    logBtn.dataset.action = 'log-meal-template';
+    logBtn.dataset.templateId = template.id;
+
+    const h = document.createElement('strong');
+    h.textContent = String(template.name || 'Unnamed meal');
+    const meta = document.createElement('span');
+    meta.className = 'muted tiny';
+    meta.textContent = `${(template.items || []).length} items • ${Math.round(totalKcal)} kcal`;
+    logBtn.append(h, meta);
+
+    const actions = document.createElement('div');
+    actions.className = 'meal-template-actions';
+
+    const editBtn = document.createElement('button');
+    editBtn.type = 'button';
+    editBtn.className = 'secondary tiny-action';
+    editBtn.dataset.action = 'edit-meal-template';
+    editBtn.dataset.templateId = template.id;
+    editBtn.textContent = 'Edit';
+
+    const dupBtn = document.createElement('button');
+    dupBtn.type = 'button';
+    dupBtn.className = 'secondary tiny-action';
+    dupBtn.dataset.action = 'duplicate-meal-template';
+    dupBtn.dataset.templateId = template.id;
+    dupBtn.textContent = 'Duplicate';
+
+    const delBtn = document.createElement('button');
+    delBtn.type = 'button';
+    delBtn.className = 'secondary tiny-action';
+    delBtn.dataset.action = 'delete-meal-template';
+    delBtn.dataset.templateId = template.id;
+    delBtn.textContent = 'Delete';
+
+    actions.append(editBtn, dupBtn, delBtn);
+    card.append(logBtn, actions);
+    wrap.appendChild(card);
+  });
+}
+
+export function renderMealTemplateItems(items = []) {
+  const wrap = el('mealTemplateItems');
+  if (!wrap) return;
+  wrap.innerHTML = '';
+
+  if (!items.length) {
+    const empty = document.createElement('p');
+    empty.className = 'muted';
+    empty.textContent = 'No items yet. Click “Add item”.';
+    wrap.appendChild(empty);
+    return;
+  }
+
+  items.forEach((item, index) => {
+    const row = document.createElement('div');
+    row.className = 'meal-template-item-row';
+
+    const top = document.createElement('div');
+    top.className = 'meal-template-item-top';
+
+    const label = document.createElement('strong');
+    label.textContent = item.label;
+
+    const removeBtn = document.createElement('button');
+    removeBtn.type = 'button';
+    removeBtn.className = 'secondary';
+    removeBtn.dataset.action = 'remove-meal-item';
+    removeBtn.dataset.index = String(index);
+    removeBtn.textContent = 'Remove';
+
+    top.append(label, removeBtn);
+
+    const gramsLabel = document.createElement('label');
+    gramsLabel.textContent = 'Default grams';
+    const gramsInput = document.createElement('input');
+    gramsInput.type = 'number';
+    gramsInput.min = '1';
+    gramsInput.step = '1';
+    gramsInput.value = String(Math.round(Number(item.gramsDefault || 100)) || 100);
+    gramsInput.dataset.index = String(index);
+    gramsInput.dataset.action = 'meal-item-grams';
+    gramsLabel.appendChild(gramsInput);
+
+    const kcalInfo = document.createElement('div');
+    kcalInfo.className = 'muted tiny';
+    const grams = Number(item.gramsDefault || 100);
+    const per100 = Number(item.per100g?.kcal || 0);
+    const kcal = Number.isFinite(grams) && Number.isFinite(per100) ? Math.round((grams / 100) * per100) : 0;
+    kcalInfo.textContent = `~ ${kcal} kcal`;
+
+    row.append(top, gramsLabel, kcalInfo);
+    wrap.appendChild(row);
+  });
+}
+
+export function renderMealTemplateSearchResults(items = []) {
+  const wrap = el('mealTemplateSearchResults');
+  if (!wrap) return;
+  wrap.innerHTML = '';
+
+  if (!items.length) {
+    const empty = document.createElement('p');
+    empty.className = 'muted';
+    empty.textContent = 'No matching foods found.';
+    wrap.appendChild(empty);
+    return;
+  }
+
+  items.forEach((item) => {
+    const btn = document.createElement('button');
+    btn.type = 'button';
+    btn.className = 'suggestion';
+    btn.dataset.action = 'select-meal-item';
+    btn.dataset.foodId = item.foodId;
+
+    const left = document.createElement('div');
+    const strong = document.createElement('strong');
+    strong.textContent = item.label;
+    const sub = document.createElement('div');
+    sub.className = 'muted tiny';
+    sub.textContent = item.groupLabel || '';
+    left.append(strong, sub);
+
+    const right = document.createElement('span');
+    right.className = 'muted tiny';
+    const per100 = macroPer100FromAny(item.nutrition);
+    right.textContent = `${Math.round(Number(per100.kcal) || 0)} kcal/100g`;
+
+    btn.append(left, right);
+    wrap.appendChild(btn);
+  });
+}
+
+export function openMealTemplateDialog() {
+  el('mealTemplateDialog').showModal();
+}
+
+export function closeMealTemplateDialog() {
+  el('mealTemplateDialog').close();
+}

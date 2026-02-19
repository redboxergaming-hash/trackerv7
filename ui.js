function pct(value, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

export function renderDashboard(model) {
  const kpiRow = document.getElementById('kpiRow');
  const macroCards = document.getElementById('macroCards');
  const habitCards = document.getElementById('habitCards');

  if (!kpiRow || !macroCards || !habitCards) return;

  kpiRow.innerHTML = `
    <div class="pill tile"><div class="label">Calories</div><div class="value">${model.kcal}/${model.kcalGoal}</div></div>
    <div class="pill tile"><div class="label">Meals</div><div class="value">${model.meals}</div></div>
    <div class="pill tile"><div class="label">Streak</div><div class="value">${model.streak} days</div></div>
  `;

  macroCards.innerHTML = model.macros.map((m) => `
    <article class="tile">
      <div class="label">${m.name}</div>
      <div class="value">${m.value}g / ${m.goal}g</div>
      <div class="progress ${pct(m.value, m.goal) >= 100 ? 'good' : 'warn'}"><span style="width:${pct(m.value, m.goal)}%"></span></div>
    </article>
  `).join('');

  habitCards.innerHTML = model.habits.map((h) => `
    <article class="tile">
      <div class="label">${h.name}</div>
      <div class="value">${h.value}/${h.goal}</div>
      <div class="progress ${pct(h.value, h.goal) >= 100 ? 'good' : ''}"><span style="width:${pct(h.value, h.goal)}%"></span></div>
    </article>
  `).join('');
}

export function renderFastingCard(viewModel, selectedPresetHours) {
  const root = document.getElementById('fastingCard');
  if (!root) return;

  root.innerHTML = `
    <h3>Fasting</h3>
    <div class="fasting-presets">
      <button type="button" class="preset-chip ${selectedPresetHours === 16 ? 'active' : ''}" data-preset-hours="16">16:8</button>
      <button type="button" class="preset-chip ${selectedPresetHours === 18 ? 'active' : ''}" data-preset-hours="18">18:6</button>
    </div>
    <div class="tile fasting-tile">
      <div class="label" id="fastingDurationLabel">${viewModel.durationLabel}</div>
      ${viewModel.targetEndLabel ? `<div class="label" id="fastingTargetLabel">${viewModel.targetEndLabel}</div>` : ''}
      <div class="value" id="fastingStreakLabel">Streak: ${viewModel.streak} day${viewModel.streak === 1 ? '' : 's'}</div>
      <button id="fastingToggleBtn" type="button">${viewModel.ctaLabel}</button>
    </div>
  `;
}

import { getFastingViewModel, toggleFast } from './fasting.js';
import { getFastingLogsByPerson } from './storage.js';
import { renderDashboard, renderFastingCard } from './ui.js';

const ACTIVE_PERSON_ID = 'person-1';

const dashboardModel = {
  kcal: 1830,
  kcalGoal: 2200,
  meals: 4,
  streak: 6,
  macros: [
    { name: 'Protein', value: 142, goal: 160 },
    { name: 'Carbs', value: 188, goal: 230 },
    { name: 'Fat', value: 62, goal: 70 }
  ],
  habits: [
    { name: 'Water (ml)', value: 2100, goal: 2500 },
    { name: 'Exercise (min)', value: 38, goal: 45 },
    { name: 'Sleep (h)', value: 7, goal: 8 }
  ]
};

const dayEntries = [
  { label: 'Greek Yogurt', kcal: 210, p: 20, c: 15, f: 7 },
  { label: 'Chicken Bowl', kcal: 670, p: 52, c: 64, f: 18 },
  { label: 'Almonds', kcal: 190, p: 7, c: 6, f: 16 },
  { label: 'Salmon + Rice', kcal: 760, p: 63, c: 103, f: 21 }
];

let activeRefreshTimer = null;
let selectedPresetHours = 16;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readReportFilters() {
  const personId = document.getElementById('reportPersonPicker')?.value || ACTIVE_PERSON_ID;
  const date = document.getElementById('reportDatePicker')?.value || todayIso();
  return { personId, date };
}

function showDashboardStatus(message) {
  const status = document.getElementById('dashboardStatus');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  setTimeout(() => {
    status.hidden = true;
  }, 2400);
}

function computeEntryTotals(entries) {
  return entries.reduce((acc, item) => ({
    kcal: acc.kcal + Number(item.kcal || 0),
    p: acc.p + Number(item.p || 0),
    c: acc.c + Number(item.c || 0),
    f: acc.f + Number(item.f || 0)
  }), { kcal: 0, p: 0, c: 0, f: 0 });
}

async function buildDayReport(personId, date) {
  const fastingLogs = await getFastingLogsByPerson(personId);
  const fasting = fastingLogs.find((item) => item.dateKey === date) || null;

  return {
    personId,
    date,
    entries: dayEntries,
    totals: computeEntryTotals(dayEntries),
    habits: {
      waterMl: 2100,
      exerciseMin: 38
    },
    fasting: fasting
      ? {
          startAt: fasting.startAt,
          endAt: fasting.endAt,
          durationMin: fasting.endAt ? Math.floor((fasting.endAt - fasting.startAt) / 60000) : null
        }
      : null
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportSelectedDay() {
  const { personId, date } = readReportFilters();
  const report = await buildDayReport(personId, date);
  const filename = `day-report-${personId}-${date}.json`;
  downloadJson(filename, report);
  showDashboardStatus('Day report exported');
}

async function renderFasting() {
  const model = await getFastingViewModel(ACTIVE_PERSON_ID, { presetHours: selectedPresetHours });
  renderFastingCard(model, selectedPresetHours);

  const toggleButton = document.getElementById('fastingToggleBtn');
  if (toggleButton) {
    toggleButton.addEventListener('click', async () => {
      await toggleFast(ACTIVE_PERSON_ID);
      await renderFasting();
    });
  }

  document.querySelectorAll('[data-preset-hours]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = Number(button.dataset.presetHours);
      if (value !== 16 && value !== 18) return;
      selectedPresetHours = value;
      await renderFasting();
    });
  });

  if (activeRefreshTimer) {
    clearInterval(activeRefreshTimer);
    activeRefreshTimer = null;
  }

  if (model.active) {
    activeRefreshTimer = setInterval(() => {
      renderFasting();
    }, 30000);
  }
}

async function boot() {
  renderDashboard(dashboardModel);
  const datePicker = document.getElementById('reportDatePicker');
  if (datePicker) datePicker.value = todayIso();

  const exportButton = document.getElementById('exportDayBtn');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      exportSelectedDay();
    });
  }

  await renderFasting();
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
});

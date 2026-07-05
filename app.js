const STORAGE_KEY = 'grafik-smen-settings';

const MARKERS = {
  away: { id: 'away', label: 'Не дома', desc: 'Выходной, но не дома' },
};

const defaultSettings = () => {
  const today = formatDateISO(new Date());
  return {
    job1: {
      name: 'Работа 1',
      startDate: today,
      workDays: 1,
      restDays: 2,
    },
    job2: {
      enabled: false,
      name: 'Работа 2',
      startDate: today,
      workDays: 1,
      restDays: 2,
    },
    manualMarks: {},
  };
};

let settings = loadSettings();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selectedDayISO = null;

const els = {
  summary: document.getElementById('summary'),
  monthTitle: document.getElementById('monthTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  legend: document.getElementById('legend'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  job2Enabled: document.getElementById('job2Enabled'),
  job2Fields: document.getElementById('job2Fields'),
  dayDialog: document.getElementById('dayDialog'),
  dayDialogTitle: document.getElementById('dayDialogTitle'),
  dayAutoStatus: document.getElementById('dayAutoStatus'),
  markerOptions: document.getElementById('markerOptions'),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultSettings(),
        ...parsed,
        job1: { ...defaultSettings().job1, ...parsed.job1 },
        job2: { ...defaultSettings().job2, ...parsed.job2 },
        manualMarks: parsed.manualMarks && typeof parsed.manualMarks === 'object' ? parsed.manualMarks : {},
      };
    }
  } catch (_) {}
  return defaultSettings();
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateISO(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from, to) {
  const a = parseDateISO(formatDateISO(from));
  const b = parseDateISO(formatDateISO(to));
  return Math.round((b - a) / 86400000);
}

function isShiftDay(date, job) {
  if (!job.startDate) return false;
  const start = parseDateISO(job.startDate);
  const diff = daysBetween(start, date);
  const cycle = job.workDays + job.restDays;
  if (cycle <= 0) return false;

  let pos = diff % cycle;
  if (pos < 0) pos += cycle;
  return pos < job.workDays;
}

function getDayStatus(date) {
  const j1 = isShiftDay(date, settings.job1);
  const j2 = settings.job2.enabled && isShiftDay(date, settings.job2);
  const mark = settings.manualMarks[formatDateISO(date)] || null;
  return { j1, j2, both: j1 && j2, mark };
}

function describeAutoStatus(status) {
  if (status.both) return 'По графику: сутки на обеих работах';
  if (status.j1) return `По графику: сутки — ${settings.job1.name}`;
  if (status.j2) return `По графику: сутки — ${settings.job2.name}`;
  return 'По графику: дома / выходной';
}

function monthName(year, month) {
  return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function renderCalendar() {
  els.monthTitle.textContent = monthName(viewYear, viewMonth);

  const first = new Date(viewYear, viewMonth, 1);
  let startOffset = first.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO = formatDateISO(new Date());

  els.calendarGrid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    els.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const iso = formatDateISO(date);
    const status = getDayStatus(date);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell';
    cell.textContent = day;

    if (iso === todayISO) cell.classList.add('today');
    if (status.both) cell.classList.add('both');
    else if (status.j1) cell.classList.add('job1');
    else if (status.j2) cell.classList.add('job2');

    if (status.mark === 'away') cell.classList.add('mark-away');

    if (status.j1 || status.j2) {
      const dots = document.createElement('div');
      dots.className = 'dots';
      if (status.j1) {
        const dot = document.createElement('span');
        dot.className = 'dot job1';
        dots.appendChild(dot);
      }
      if (status.j2) {
        const dot = document.createElement('span');
        dot.className = 'dot job2';
        dots.appendChild(dot);
      }
      cell.appendChild(dots);
    }

    const labels = [];
    if (status.j1) labels.push(settings.job1.name);
    if (status.j2) labels.push(settings.job2.name);
    if (status.mark === 'away') labels.push('Не дома');
    if (labels.length) cell.title = labels.join(' · ');

    cell.addEventListener('click', () => openDayDialog(iso));

    els.calendarGrid.appendChild(cell);
  }
}

function findNextShift(fromDate, jobKey) {
  const job = settings[jobKey];
  if (jobKey === 'job2' && !job.enabled) return null;

  for (let i = 0; i <= 366; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    if (isShiftDay(d, job)) return d;
  }
  return null;
}

function findNextFreeDay(fromDate) {
  for (let i = 0; i <= 366; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const s = getDayStatus(d);
    if (!s.j1 && !s.j2 && s.mark !== 'away') return d;
  }
  return null;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function countConflictsInMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (getDayStatus(new Date(year, month, d)).both) count++;
  }
  return count;
}

function renderSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStatus = getDayStatus(today);

  const cards = [];

  if (todayStatus.both) {
    cards.push(`<div class="summary-card warning"><strong>Сегодня</strong><span>⚠️ Сутки на ОБЕИХ работах — конфликт!</span></div>`);
  } else if (todayStatus.j1) {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🌙 Сутки — ${escapeHtml(settings.job1.name)}</span></div>`);
  } else if (todayStatus.j2) {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🌙 Сутки — ${escapeHtml(settings.job2.name)}</span></div>`);
  } else if (todayStatus.mark === 'away') {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🚗 Не дома (выходной)</span></div>`);
  } else {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🏠 Дома, выходной</span></div>`);
  }

  const nextJ1 = findNextShift(today, 'job1');
  if (nextJ1 && !todayStatus.j1) {
    cards.push(`<div class="summary-card"><strong>Ближайшие сутки (${escapeHtml(settings.job1.name)})</strong><span>${formatDayLabel(nextJ1)}</span></div>`);
  }

  if (settings.job2.enabled) {
    const nextJ2 = findNextShift(today, 'job2');
    if (nextJ2 && !todayStatus.j2) {
      cards.push(`<div class="summary-card"><strong>Ближайшие сутки (${escapeHtml(settings.job2.name)})</strong><span>${formatDayLabel(nextJ2)}</span></div>`);
    }

    const conflicts = countConflictsInMonth(viewYear, viewMonth);
    if (conflicts > 0) {
      cards.push(`<div class="summary-card warning"><strong>Конфликты в этом месяце</strong><span>${conflicts} ${pluralDays(conflicts)} — сутки на обеих работах</span></div>`);
    }
  }

  if (!todayStatus.j1 && !todayStatus.j2 && todayStatus.mark !== 'away') {
    const nextFree = findNextFreeDay(new Date(today.getTime() + 86400000));
    if (nextFree) {
      cards.push(`<div class="summary-card"><strong>Следующий день дома</strong><span>${formatDayLabel(nextFree)}</span></div>`);
    }
  }

  els.summary.innerHTML = cards.join('');
}

function pluralDays(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLegend() {
  const items = [
    `<div class="legend-item"><span class="legend-swatch job1"></span>${escapeHtml(settings.job1.name)}</div>`,
    `<div class="legend-item"><span class="legend-swatch home"></span>Дома / выходной</div>`,
    `<div class="legend-item"><span class="legend-swatch away"></span>Не дома (метка)</div>`,
  ];
  if (settings.job2.enabled) {
    items.splice(1, 0, `<div class="legend-item"><span class="legend-swatch job2"></span>${escapeHtml(settings.job2.name)}</div>`);
    items.push(`<div class="legend-item"><span class="legend-swatch both"></span>Конфликт (обе работы)</div>`);
  }
  els.legend.innerHTML = items.join('');
}

function openDayDialog(iso) {
  selectedDayISO = iso;
  const date = parseDateISO(iso);
  const status = getDayStatus(date);
  const currentMark = settings.manualMarks[iso] || null;

  els.dayDialogTitle.textContent = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  els.dayAutoStatus.textContent = describeAutoStatus(status);

  els.markerOptions.innerHTML = '';

  const noneBtn = createMarkerButton(null, 'Без метки', 'Только по графику', currentMark);
  els.markerOptions.appendChild(noneBtn);

  Object.values(MARKERS).forEach((marker) => {
    els.markerOptions.appendChild(
      createMarkerButton(marker.id, marker.label, marker.desc, currentMark)
    );
  });

  els.dayDialog.showModal();
}

function createMarkerButton(markerId, label, desc, currentMark) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'marker-btn';
  if (markerId === 'away') btn.classList.add('marker-away');
  if (currentMark === markerId) btn.classList.add('selected');

  const swatchClass = markerId ? markerId : 'none';
  btn.innerHTML = `
    <span class="marker-swatch ${swatchClass === 'away' ? 'away' : 'none'}"></span>
    <span><strong>${escapeHtml(label)}</strong><br><span style="font-size:0.8125rem;color:var(--text-muted)">${escapeHtml(desc)}</span></span>
  `;

  btn.addEventListener('click', () => setDayMark(markerId));
  return btn;
}

function setDayMark(markerId) {
  if (!selectedDayISO) return;

  if (markerId) {
    settings.manualMarks[selectedDayISO] = markerId;
  } else {
    delete settings.manualMarks[selectedDayISO];
  }

  saveSettings();
  render();
  els.dayDialog.close();
  selectedDayISO = null;
}

function render() {
  renderSummary();
  renderCalendar();
  renderLegend();
}

function openSettings() {
  document.getElementById('job1Name').value = settings.job1.name;
  document.getElementById('job1Start').value = settings.job1.startDate;
  document.getElementById('job1Work').value = settings.job1.workDays;
  document.getElementById('job1Rest').value = settings.job1.restDays;

  els.job2Enabled.checked = settings.job2.enabled;
  document.getElementById('job2Name').value = settings.job2.name;
  document.getElementById('job2Start').value = settings.job2.startDate;
  document.getElementById('job2Work').value = settings.job2.workDays;
  document.getElementById('job2Rest').value = settings.job2.restDays;

  updateJob2Fields();
  els.settingsDialog.showModal();
}

function updateJob2Fields() {
  els.job2Fields.classList.toggle('enabled', els.job2Enabled.checked);
}

function readSettingsFromForm() {
  settings = {
    job1: {
      name: document.getElementById('job1Name').value.trim() || 'Работа 1',
      startDate: document.getElementById('job1Start').value,
      workDays: Math.max(1, parseInt(document.getElementById('job1Work').value, 10) || 1),
      restDays: Math.max(0, parseInt(document.getElementById('job1Rest').value, 10) || 0),
    },
    job2: {
      enabled: els.job2Enabled.checked,
      name: document.getElementById('job2Name').value.trim() || 'Работа 2',
      startDate: document.getElementById('job2Start').value || document.getElementById('job1Start').value,
      workDays: Math.max(1, parseInt(document.getElementById('job2Work').value, 10) || 1),
      restDays: Math.max(0, parseInt(document.getElementById('job2Rest').value, 10) || 0),
    },
    manualMarks: settings.manualMarks,
  };
  saveSettings();
  render();
}

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('btnCloseSettings').addEventListener('click', () => els.settingsDialog.close());
document.getElementById('btnCloseDay').addEventListener('click', () => els.dayDialog.close());
els.job2Enabled.addEventListener('change', updateJob2Fields);

els.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  readSettingsFromForm();
  els.settingsDialog.close();
});

document.getElementById('prevMonth').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  }
  render();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  render();
});

document.getElementById('btnToday').addEventListener('click', () => {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render();
});

if (!localStorage.getItem(STORAGE_KEY)) {
  setTimeout(openSettings, 400);
}

render();

const STORAGE_KEY = 'grafik-smen-settings';

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
    dayNotes: {},
  };
};

function getNote(iso) {
  return settings.dayNotes[iso] || '';
}

let settings = loadSettings();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selectedDayISO = null;
let touchStartX = 0;

const els = {
  summary: document.getElementById('summary'),
  monthStats: document.getElementById('monthStats'),
  monthTitle: document.getElementById('monthTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  calendarSection: document.getElementById('calendarSection'),
  legend: document.getElementById('legend'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  job2Enabled: document.getElementById('job2Enabled'),
  job2Fields: document.getElementById('job2Fields'),
  dayDialog: document.getElementById('dayDialog'),
  dayDialogTitle: document.getElementById('dayDialogTitle'),
  dayAutoStatus: document.getElementById('dayAutoStatus'),
  dayNoteInput: document.getElementById('dayNoteInput'),
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
        dayNotes: parsed.dayNotes && typeof parsed.dayNotes === 'object' ? parsed.dayNotes : {},
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
  const iso = formatDateISO(date);
  const j1 = isShiftDay(date, settings.job1);
  const j2 = settings.job2.enabled && isShiftDay(date, settings.job2);
  const note = getNote(iso);
  return { j1, j2, note };
}

function describeAutoStatus(status) {
  if (status.j1 || status.j2) return 'По графику: сутки';
  return 'По графику: дома';
}

function monthName(year, month) {
  const raw = new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function daysUntilLabel(n) {
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  return `через ${n} ${pluralDays(n)}`;
}

function shiftUntilLabel(daysUntil) {
  if (daysUntil === 0) return 'Сутки сегодня';
  if (daysUntil === 1) return 'Сутки завтра';
  return `Сутки через ${daysUntil} ${pluralDays(daysUntil)}`;
}

function getMonthStats(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const stats = { j1: 0, j2: 0, home: 0, notes: 0 };

  for (let d = 1; d <= daysInMonth; d++) {
    const s = getDayStatus(new Date(year, month, d));
    if (s.j1) stats.j1++;
    else if (s.j2) stats.j2++;
    else stats.home++;
    if (s.note) stats.notes++;
  }

  return stats;
}

function renderMonthStats() {
  const s = getMonthStats(viewYear, viewMonth);
  const chips = [
    `<div class="stat-chip job1"><strong>${s.j1}</strong><span>${escapeHtml(settings.job1.name)}</span></div>`,
    `<div class="stat-chip home"><strong>${s.home}</strong><span>Дома</span></div>`,
    `<div class="stat-chip notes"><strong>${s.notes}</strong><span>Заметки</span></div>`,
  ];

  if (settings.job2.enabled) {
    chips.splice(1, 0, `<div class="stat-chip job2"><strong>${s.j2}</strong><span>${escapeHtml(settings.job2.name)}</span></div>`);
  }

  els.monthStats.innerHTML = chips.join('');
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

    const dayNum = document.createElement('span');
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    if (iso === todayISO) cell.classList.add('today');
    if (status.j1) cell.classList.add('job1');
    else if (status.j2) cell.classList.add('job2');
    if (status.note) cell.classList.add('has-note');

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
    if (status.j1) labels.push('Сутки');
    if (status.j2) labels.push('Сутки');
    if (status.note) labels.push(status.note);
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
    if (isShiftDay(d, job)) return { date: d, daysUntil: i };
  }
  return null;
}

function findNextFreeDay(fromDate) {
  for (let i = 0; i <= 366; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const s = getDayStatus(d);
    if (!s.j1 && !s.j2) return { date: d, daysUntil: i };
  }
  return null;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStatus = getDayStatus(today);
  const cards = [];

  if (todayStatus.j1 || todayStatus.j2) {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🌙 Сутки</span></div>`);
  } else if (todayStatus.note) {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>📝 ${escapeHtml(todayStatus.note)}</span></div>`);
  } else {
    cards.push(`<div class="summary-card"><strong>Сегодня</strong><span>🏠 Дома</span></div>`);
  }

  const nextJ1 = findNextShift(today, 'job1');
  if (nextJ1 && !todayStatus.j1) {
    cards.push(
      `<div class="summary-card highlight"><span>🌙 ${shiftUntilLabel(nextJ1.daysUntil)}</span><small>${formatDayLabel(nextJ1.date)}</small></div>`
    );
  }

  if (settings.job2.enabled) {
    const nextJ2 = findNextShift(today, 'job2');
    if (nextJ2 && !todayStatus.j2 && (!nextJ1 || nextJ2.date.getTime() !== nextJ1.date.getTime())) {
      cards.push(
        `<div class="summary-card highlight"><span>🌙 ${shiftUntilLabel(nextJ2.daysUntil)}</span><small>${formatDayLabel(nextJ2.date)}</small></div>`
      );
    }
  }

  if (!todayStatus.j1 && !todayStatus.j2) {
    const nextFree = findNextFreeDay(new Date(today.getTime() + 86400000));
    if (nextFree) {
      cards.push(
        `<div class="summary-card"><strong>День дома</strong><span>${daysUntilLabel(nextFree.daysUntil)} · ${formatDayLabel(nextFree.date)}</span></div>`
      );
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
    `<div class="legend-item"><span class="legend-swatch job1"></span>Сутки (${escapeHtml(settings.job1.name)})</div>`,
    `<div class="legend-item"><span class="legend-swatch home"></span>Дома</div>`,
    `<div class="legend-item"><span class="legend-swatch note"></span>Заметка</div>`,
  ];
  if (settings.job2.enabled) {
    items.splice(1, 0, `<div class="legend-item"><span class="legend-swatch job2"></span>Сутки (${escapeHtml(settings.job2.name)})</div>`);
  }
  els.legend.innerHTML = items.join('');
}

function openDayDialog(iso) {
  selectedDayISO = iso;
  const date = parseDateISO(iso);
  const status = getDayStatus(date);

  els.dayDialogTitle.textContent = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  els.dayAutoStatus.textContent = describeAutoStatus(status);
  els.dayNoteInput.value = getNote(iso);
  els.dayDialog.showModal();
  setTimeout(() => els.dayNoteInput.focus(), 100);
}

function saveDayDialog() {
  if (!selectedDayISO) return;

  const note = els.dayNoteInput.value.trim();
  if (note) settings.dayNotes[selectedDayISO] = note;
  else delete settings.dayNotes[selectedDayISO];

  saveSettings();
  render();
  els.dayDialog.close();
  selectedDayISO = null;
}

function clearDayNote() {
  if (!selectedDayISO) return;
  els.dayNoteInput.value = '';
  delete settings.dayNotes[selectedDayISO];
  saveSettings();
  render();
  els.dayDialog.close();
  selectedDayISO = null;
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  } else if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  render();
}

async function exportMonthImage() {
  const btn = document.getElementById('btnExport');
  if (btn) btn.disabled = true;

  try {
    const canvas = buildCalendarCanvas();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png');
    });

    const file = new File([blob], `grafik-${viewYear}-${viewMonth + 1}.png`, { type: 'image/png' });
    const title = monthName(viewYear, viewMonth);

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `График — ${title}`, files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  } catch (_) {
    alert('Не получилось. Попробуй ещё раз.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildCalendarCanvas() {
  const pad = 20;
  const cols = 7;
  const gap = 5;
  const cell = 42;
  const titleH = 34;
  const weekH = 22;
  const gridW = cols * cell + (cols - 1) * gap;
  const first = new Date(viewYear, viewMonth, 1);
  let startOffset = first.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const rows = Math.ceil((startOffset + daysInMonth) / cols);
  const width = pad * 2 + gridW;
  const height = pad + titleH + weekH + rows * cell + (rows - 1) * gap + pad;

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#1a2332';
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();

  ctx.fillStyle = '#e8edf4';
  ctx.font = '600 17px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(monthName(viewYear, viewMonth), width / 2, pad + 22);

  const weekLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  ctx.font = '600 10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#8b9cb3';
  weekLabels.forEach((label, i) => {
    ctx.fillText(label, pad + i * (cell + gap) + cell / 2, pad + titleH + 14);
  });

  const todayISO = formatDateISO(new Date());
  let dayNum = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index < startOffset || dayNum > daysInMonth) continue;

      const date = new Date(viewYear, viewMonth, dayNum);
      const iso = formatDateISO(date);
      const status = getDayStatus(date);
      const x = pad + col * (cell + gap);
      const y = pad + titleH + weekH + row * (cell + gap);

      if (status.j1) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.55)';
        roundRect(ctx, x, y, cell, cell, 10);
        ctx.fill();
      } else if (status.j2) {
        ctx.fillStyle = 'rgba(147, 51, 234, 0.55)';
        roundRect(ctx, x, y, cell, cell, 10);
        ctx.fill();
      } else if (status.note) {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.65)';
        roundRect(ctx, x, y, cell, cell, 10);
        ctx.fill();
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2;
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 9);
        ctx.stroke();
      }

      if (status.note && (status.j1 || status.j2)) {
        ctx.fillStyle = '#ea580c';
        roundRect(ctx, x + 3, y + cell - 7, cell - 6, 4, 2);
        ctx.fill();
      }

      if (iso === todayISO) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 9);
        ctx.stroke();
      }

      ctx.fillStyle = status.j1 || status.j2 || status.note ? '#fff' : '#e8edf4';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(dayNum), x + cell / 2, y + cell / 2);
      dayNum++;
    }
  }

  return canvas;
}

function render() {
  renderSummary();
  renderMonthStats();
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
    dayNotes: settings.dayNotes,
  };
  saveSettings();
  render();
}

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('btnCloseSettings').addEventListener('click', () => els.settingsDialog.close());
document.getElementById('btnCloseDay').addEventListener('click', () => els.dayDialog.close());
document.getElementById('btnSaveDay').addEventListener('click', saveDayDialog);
document.getElementById('btnClearNote').addEventListener('click', clearDayNote);
document.getElementById('btnExport').addEventListener('click', exportMonthImage);
els.job2Enabled.addEventListener('change', updateJob2Fields);

els.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  readSettingsFromForm();
  els.settingsDialog.close();
});

document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

document.getElementById('btnToday').addEventListener('click', () => {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render();
});

els.calendarSection.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

els.calendarSection.addEventListener('touchend', (e) => {
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff) < 50) return;
  changeMonth(diff > 0 ? -1 : 1);
}, { passive: true });

if (!localStorage.getItem(STORAGE_KEY)) {
  setTimeout(openSettings, 400);
}

render();

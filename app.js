// ============ STORAGE HELPERS ============
const STORAGE_KEYS = {
  historial: "rutina_historial",
  progress: (dayId) => `rutina_progreso_${dayId}`,
};

function getHistorial() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.historial)) || []; }
  catch { return []; }
}
function setHistorial(list) {
  localStorage.setItem(STORAGE_KEYS.historial, JSON.stringify(list));
}
function getProgress(dayId) {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.progress(dayId))) || null; }
  catch { return null; }
}
function setProgress(dayId, data) {
  localStorage.setItem(STORAGE_KEYS.progress(dayId), JSON.stringify(data));
}
function clearProgress(dayId) {
  localStorage.removeItem(STORAGE_KEYS.progress(dayId));
}

// ============ STATE ============
let currentView = "d1"; // day id or "historial"
let historyMode = "lista"; // "lista" | "calendario"
let activeTimerKey = null;
let timerInterval = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============ DAY NAV ============
function renderDayNav() {
  const nav = $("#day-nav");
  nav.innerHTML = "";
  DAY_ORDER.forEach((id) => {
    const day = DAYS[id];
    const type = DAY_TYPES[day.type];
    const btn = document.createElement("button");
    btn.className = "day-tab" + (currentView === id ? " active" : "");
    btn.style.setProperty("--tab-color", type.color);
    btn.innerHTML = `<span class="tab-num">${day.order}</span> <span style="color:${currentView===id ? type.color : ''}">${day.subtitle}</span>`;
    btn.onclick = () => { currentView = id; render(); };
    nav.appendChild(btn);
  });
  const histBtn = document.createElement("button");
  histBtn.className = "day-tab day-tab-history" + (currentView === "historial" ? " active" : "");
  histBtn.style.setProperty("--tab-color", "#33301F");
  histBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg> Historial`;
  histBtn.onclick = () => { currentView = "historial"; render(); };
  nav.appendChild(histBtn);
}

// ============ RENDER DISPATCH ============
function render() {
  renderDayNav();
  const main = $("#main-content");
  const saveBar = $("#save-bar");
  if (currentView === "historial") {
    saveBar.classList.add("hidden");
    main.innerHTML = "";
    renderHistorial(main);
  } else {
    saveBar.classList.remove("hidden");
    main.innerHTML = "";
    renderDay(main, currentView);
  }
}

// ============ DAY VIEW ============
function renderDay(container, dayId) {
  const day = DAYS[dayId];
  const type = DAY_TYPES[day.type];
  const saved = getProgress(dayId) || { warmup: [], stretch: [], exercises: {} };

  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `
    <div class="day-header-title">
      <h1>${day.label}</h1>
      <span class="day-type-name" style="color:${type.color}">${day.subtitle}</span>
    </div>
    <div class="day-focus">${day.focus}</div>
    <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%; background:${type.color}"></div></div>
    <div class="progress-label" id="progress-label">0/0 series completadas</div>
  `;
  container.appendChild(header);

  // Warmup
  container.appendChild(renderCollapsible("🔥 Calentamiento", day.warmup, saved.warmup, (idx, checked) => {
    saved.warmup[idx] = checked;
    setProgress(dayId, saved);
  }));

  // Exercises
  const list = document.createElement("div");
  list.className = "exercise-list";
  day.exercises.forEach((ex, idx) => {
    list.appendChild(renderExerciseCard(dayId, ex, idx, saved));
  });
  container.appendChild(list);

  // Stretch
  container.appendChild(renderCollapsible("🧘 Estiramiento final", day.stretch, saved.stretch, (idx, checked) => {
    saved.stretch[idx] = checked;
    setProgress(dayId, saved);
  }));

  updateProgress(dayId);

  // Save bar button
  const btn = $("#btn-complete");
  const label = $("#btn-complete-label");
  btn.classList.remove("saved");
  label.textContent = "Completar sesión y reiniciar";
  btn.onclick = () => completeSession(dayId);
  updateSaveBarState(dayId);
}

function renderCollapsible(title, items, savedArr, onToggle) {
  const wrap = document.createElement("div");
  wrap.className = "collapsible";
  const summary = document.createElement("div");
  summary.className = "collapsible-summary";
  summary.innerHTML = `<span>${title}</span><svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  summary.onclick = () => wrap.classList.toggle("open");
  wrap.appendChild(summary);

  const body = document.createElement("div");
  body.className = "collapsible-body";
  items.forEach((text, idx) => {
    const checked = !!(savedArr && savedArr[idx]);
    const line = document.createElement("label");
    line.className = "check-line" + (checked ? " done" : "");
    line.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span>${text}</span>`;
    line.querySelector("input").onchange = (e) => {
      line.classList.toggle("done", e.target.checked);
      onToggle(idx, e.target.checked);
    };
    body.appendChild(line);
  });
  wrap.appendChild(body);
  return wrap;
}

function renderExerciseCard(dayId, ex, idx, saved) {
  const key = `${dayId}-${idx}`;
  const setChecks = (saved.exercises[key]) || Array(ex.sets).fill(false);
  saved.exercises[key] = setChecks;
  const doneCount = setChecks.filter(Boolean).length;
  const allDone = doneCount === ex.sets;

  const card = document.createElement("div");
  card.className = "ex-card" + (allDone ? " done" : "");
  card.dataset.key = key;

  const head = document.createElement("div");
  head.className = "ex-head";
  head.innerHTML = `
    <div class="ex-head-left">
      <div class="ex-badge">${allDone ? "✓" : idx + 1}</div>
      <div class="ex-title">
        <div class="name">${ex.name}</div>
        <div class="meta">${ex.sets} × ${ex.reps}${ex.techo ? " · techo " + ex.techo : ""} · <span class="done-count">${doneCount}</span>/${ex.sets} series</div>
      </div>
    </div>
    <svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  const body = document.createElement("div");
  body.className = "ex-body";
  body.style.display = "none";
  const inner = document.createElement("div");
  inner.className = "ex-body-inner";
  inner.innerHTML = `
    <div class="ex-block"><b>Postura:</b> ${ex.postura}</div>
    <div class="ex-block"><b>Ejecución:</b> ${ex.ejecucion}</div>
    ${ex.risk ? `<div class="ex-risk">⚠️ ${ex.risk}</div>` : ""}
    ${ex.extra ? `<div class="ex-extra">${ex.extra}</div>` : ""}
    <div class="set-row" id="set-row-${key}"></div>
  `;
  body.appendChild(inner);

  head.onclick = () => {
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    head.querySelector(".chev").style.transform = isOpen ? "" : "rotate(180deg)";
  };

  card.appendChild(head);
  card.appendChild(body);

  // Defer set-row rendering until appended (need DOM ref)
  requestAnimationFrame(() => {
    const setRow = card.querySelector(`#set-row-${CSS.escape(key)}`);
    for (let i = 0; i < ex.sets; i++) {
      const b = document.createElement("button");
      b.className = "set-btn" + (setChecks[i] ? " checked" : "");
      b.textContent = i + 1;
      b.onclick = () => {
        setChecks[i] = !setChecks[i];
        saved.exercises[key] = setChecks;
        setProgress(dayId, saved);
        b.classList.toggle("checked", setChecks[i]);
        const newDone = setChecks.filter(Boolean).length;
        const allNowDone = newDone === ex.sets;
        card.classList.toggle("done", allNowDone);
        card.querySelector(".ex-badge").textContent = allNowDone ? "✓" : (idx + 1);
        card.querySelector(".done-count").textContent = newDone;
        updateProgress(dayId);
        updateSaveBarState(dayId);
      };
      setRow.appendChild(b);
    }
    setRow.appendChild(renderTimerChip(key, ex.rest));
  });

  return card;
}

// ============ TIMER ============
function renderTimerChip(key, seconds) {
  const wrap = document.createElement("div");
  wrap.dataset.timerKey = key;
  wrap.dataset.seconds = seconds;
  buildTimerUI(wrap, key, seconds);
  return wrap;
}

function buildTimerUI(wrap, key, seconds) {
  if (activeTimerKey !== key) {
    wrap.innerHTML = `<button class="timer-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> Descanso ${seconds}s</button>`;
    wrap.querySelector("button").onclick = () => startTimer(key, seconds);
  }
}

let timerState = { key: null, remaining: 0, total: 0, running: false };

function startTimer(key, seconds) {
  stopAllTimerUIs();
  activeTimerKey = key;
  timerState = { key, remaining: seconds, total: seconds, running: true };
  clearInterval(timerInterval);
  renderActiveTimer();
  timerInterval = setInterval(() => {
    if (!timerState.running) return;
    timerState.remaining--;
    if (timerState.remaining <= 0) {
      timerState.remaining = 0;
      timerState.running = false;
      clearInterval(timerInterval);
      playBeep();
    }
    renderActiveTimer();
  }, 1000);
}

function renderActiveTimer() {
  const wrap = document.querySelector(`[data-timer-key="${CSS.escape(timerState.key)}"]`);
  if (!wrap) return;
  const warn = timerState.remaining <= 5;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  wrap.innerHTML = `
    <div class="timer-active ${warn ? "warn" : ""}">
      <span class="t-num">${fmt(timerState.remaining)}</span>
      <button data-act="toggle">${timerState.running
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}</button>
      <button data-act="reset"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
      <button data-act="close"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  wrap.querySelector('[data-act="toggle"]').onclick = () => { timerState.running = !timerState.running; renderActiveTimer(); };
  wrap.querySelector('[data-act="reset"]').onclick = () => { timerState.remaining = timerState.total; timerState.running = false; renderActiveTimer(); };
  wrap.querySelector('[data-act="close"]').onclick = () => { closeTimer(); };
}

function closeTimer() {
  clearInterval(timerInterval);
  const key = activeTimerKey;
  activeTimerKey = null;
  const wrap = document.querySelector(`[data-timer-key="${CSS.escape(key)}"]`);
  if (wrap) buildTimerUI(wrap, key, Number(wrap.dataset.seconds));
}

function stopAllTimerUIs() {
  clearInterval(timerInterval);
  if (activeTimerKey) {
    const wrap = document.querySelector(`[data-timer-key="${CSS.escape(activeTimerKey)}"]`);
    activeTimerKey = null;
    if (wrap) buildTimerUI(wrap, wrap.dataset.timerKey, Number(wrap.dataset.seconds));
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    });
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
  } catch (e) {}
}

// ============ PROGRESS ============
function updateProgress(dayId) {
  const day = DAYS[dayId];
  const saved = getProgress(dayId) || { exercises: {} };
  let total = 0, done = 0;
  day.exercises.forEach((ex, idx) => {
    total += ex.sets;
    const arr = saved.exercises[`${dayId}-${idx}`] || [];
    done += arr.filter(Boolean).length;
  });
  const pct = total ? Math.round((done / total) * 100) : 0;
  const fill = $("#progress-fill");
  const label = $("#progress-label");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = `${done}/${total} series completadas`;
  return { done, total, pct };
}

function updateSaveBarState(dayId) {
  const { done } = updateProgress(dayId);
  const btn = $("#btn-complete");
  if (btn) btn.disabled = done === 0;
}

// ============ COMPLETE SESSION ============
function completeSession(dayId) {
  const day = DAYS[dayId];
  const saved = getProgress(dayId) || { exercises: {} };
  const summary = day.exercises.map((ex, idx) => {
    const arr = saved.exercises[`${dayId}-${idx}`] || Array(ex.sets).fill(false);
    return { name: ex.name, done: arr.filter(Boolean).length, total: ex.sets };
  });
  const totalSets = summary.reduce((a, s) => a + s.total, 0);
  const doneSets = summary.reduce((a, s) => a + s.done, 0);
  const entry = {
    id: Date.now(),
    dayId,
    dayLabel: `${day.label} · ${day.subtitle}`,
    dayType: day.type,
    date: new Date().toISOString(),
    progressPct: totalSets ? Math.round((doneSets / totalSets) * 100) : 0,
    summary,
  };
  const hist = getHistorial();
  hist.unshift(entry);
  setHistorial(hist);
  clearProgress(dayId);

  const btn = $("#btn-complete");
  const label = $("#btn-complete-label");
  btn.classList.add("saved");
  label.textContent = "✓ Guardado en el historial";
  showToast("Sesión guardada · plantilla reiniciada");
  setTimeout(() => { if (currentView === dayId) render(); }, 900);
}

// ============ HISTORIAL VIEW ============
function renderHistorial(container) {
  const header = document.createElement("div");
  header.className = "history-header";
  header.innerHTML = `
    <h1>Historial de sesiones</h1>
    <div class="mode-switch">
      <button class="mode-btn ${historyMode === "lista" ? "active" : ""}" data-mode="lista">Lista</button>
      <button class="mode-btn ${historyMode === "calendario" ? "active" : ""}" data-mode="calendario">Calendario</button>
    </div>
  `;
  container.appendChild(header);
  header.querySelectorAll(".mode-btn").forEach((b) => {
    b.onclick = () => { historyMode = b.dataset.mode; render(); };
  });

  const hist = getHistorial();
  if (hist.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
      <p><b>Todavía no hay sesiones guardadas.</b></p>
      <p>Completa un día para verlo aquí.</p>`;
    container.appendChild(empty);
    return;
  }

  if (historyMode === "lista") {
    renderHistorialLista(container, hist);
  } else {
    renderHistorialCalendario(container, hist);
  }
}

function renderHistorialLista(container, hist) {
  const list = document.createElement("div");
  list.className = "hist-list";
  hist.forEach((entry) => list.appendChild(historyCard(entry)));
  container.appendChild(list);
}

function historyCard(entry) {
  const d = new Date(entry.date);
  const fecha = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
  const hora = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const type = DAY_TYPES[entry.dayType];
  const card = document.createElement("div");
  card.className = "hist-card";
  card.innerHTML = `
    <div class="hist-card-top">
      <div>
        <div class="hist-day-name" style="color:${type ? type.color : "inherit"}">${entry.dayLabel}</div>
        <div class="hist-date">${fecha} · ${hora}</div>
      </div>
      <div class="hist-pct ${entry.progressPct === 100 ? "full" : "partial"}">${entry.progressPct}%</div>
    </div>
    <div class="hist-chips">
      ${entry.summary.map(s => `<span class="hist-chip ${s.done < s.total ? "incomplete" : ""}">${s.name.length > 22 ? s.name.slice(0,22)+"…" : s.name} ${s.done}/${s.total}</span>`).join("")}
    </div>
  `;
  return card;
}

function renderHistorialCalendario(container, hist) {
  const byDate = {};
  hist.forEach((e) => {
    const key = e.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(e);
  });

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = document.createElement("div");
  monthLabel.className = "cal-month-label";
  monthLabel.textContent = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  container.appendChild(monthLabel);

  const dow = document.createElement("div");
  dow.className = "cal-grid-header";
  ["D","L","M","M","J","V","S"].forEach(d => { const s = document.createElement("span"); s.textContent = d; dow.appendChild(s); });
  container.appendChild(dow);

  const grid = document.createElement("div");
  grid.className = "cal-grid";
  for (let i = 0; i < startOffset; i++) {
    const c = document.createElement("div"); c.className = "cal-cell empty"; grid.appendChild(c);
  }
  const detailBox = document.createElement("div");
  detailBox.className = "cal-day-detail";
  detailBox.style.display = "none";

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const entries = byDate[dateStr];
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    cell.innerHTML = `${day}`;
    if (entries) {
      const dotsWrap = document.createElement("div");
      dotsWrap.style.display = "flex"; dotsWrap.style.gap = "2px";
      entries.slice(0,3).forEach(e => {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = (DAY_TYPES[e.dayType] || {}).color || "#999";
        dotsWrap.appendChild(dot);
      });
      cell.appendChild(dotsWrap);
      cell.style.cursor = "pointer";
      cell.onclick = () => {
        detailBox.style.display = "block";
        detailBox.innerHTML = `<div style="font-size:12.5px;font-weight:700;margin-bottom:8px;">${new Date(dateStr+"T00:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</div>`;
        entries.forEach(e => detailBox.appendChild(historyCard(e)));
      };
    }
    grid.appendChild(cell);
  }
  container.appendChild(grid);
  container.appendChild(detailBox);
}

// ============ TOAST ============
let toastTimeout;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.add("hidden"), 2400);
}

// ============ MENU SHEET ============
function openSheet() { $("#menu-sheet").classList.remove("hidden"); }
function closeSheet() { $("#menu-sheet").classList.add("hidden"); }

$("#btn-menu").onclick = openSheet;
$("#sheet-backdrop").onclick = closeSheet;

// ---- Export JSON ----
$("#btn-export-json").onclick = () => {
  const data = { historial: getHistorial(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `respaldo-rutina-${todayStr()}.json`);
  closeSheet();
  showToast("Respaldo JSON descargado");
};

// ---- Export XLSX ----
$("#btn-export-xlsx").onclick = () => {
  const hist = getHistorial();
  const rows = [];
  hist.forEach((e) => {
    const d = new Date(e.date);
    e.summary.forEach((s) => {
      rows.push({
        Fecha: d.toLocaleDateString("es-CO"),
        Hora: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
        Día: e.dayLabel,
        "% Sesión": e.progressPct,
        Ejercicio: s.name,
        "Series completadas": s.done,
        "Series totales": s.total,
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Historial");
  XLSX.writeFile(wb, `historial-rutina-${todayStr()}.xlsx`);
  closeSheet();
  showToast("Excel descargado");
};

// ---- Import JSON ----
$("#file-import").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed.historial || !Array.isArray(parsed.historial)) throw new Error("formato inválido");
      const current = getHistorial();
      const merged = [...parsed.historial, ...current].sort((a,b) => b.id - a.id);
      const seen = new Set();
      const dedup = merged.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
      setHistorial(dedup);
      closeSheet();
      showToast(`Importado: ${parsed.historial.length} sesiones`);
      render();
    } catch (err) {
      showToast("Archivo inválido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};

// ---- Clear all ----
$("#btn-clear-all").onclick = () => {
  if (confirm("¿Borrar todo el historial y progreso guardado? Esta acción no se puede deshacer. Exporta un respaldo antes si no estás seguro.")) {
    localStorage.clear();
    closeSheet();
    showToast("Datos borrados");
    render();
  }
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ============ SERVICE WORKER ============
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

// ============ INIT ============
render();

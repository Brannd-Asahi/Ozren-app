// ============================================================
// Ozren — app.js
// PWA con Firebase: Authentication (correo/contraseña + Google) + Firestore
// con caché local persistente — funciona offline y sincroniza sola
// entre tus dispositivos al volver la conexión.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { DAY_TYPES, DAYS, DAY_ORDER, REST_DAY, WEEKDAY_TO_DAY } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithRedirect, getRedirectResult,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, deleteDoc, collection,
  onSnapshot, getDocs,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const googleProvider = new GoogleAuthProvider();
const db = initializeFirestore(fbApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============ STATE ============
const state = {
  uid: null,
  correo: null,
  historialCache: [],       // array de sesiones (desc por fecha)
  unsubHistorial: null,
};
let currentView = null;        // se define al cargar sesión (auto-hoy)
let historyMode = "lista";
let activeTimerKey = null;
let timerInterval = null;
let alarmInterval = null;
let authMode = "login";

// ============ AUTH UI ============
function setAuthMode(mode) {
  authMode = mode;
  $("#tab-login").classList.toggle("active", mode === "login");
  $("#tab-register").classList.toggle("active", mode === "register");
  $("#auth-submit").textContent = mode === "login" ? "Iniciar sesión" : "Crear cuenta";
  hideAuthError();
}
function showAuthError(msg) { const el = $("#auth-error"); el.textContent = msg; el.classList.remove("hidden"); }
function hideAuthError() { $("#auth-error").classList.add("hidden"); }

function traducirErrorAuth(err) {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/invalid-email": "Correo inválido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo — intenta iniciar sesión.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/network-request-failed": "Sin conexión a internet.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (ver FIREBASE_SETUP.md, paso 6).",
  };
  return map[code] || (err && err.message) || "Ocurrió un error. Intenta de nuevo.";
}

function initAuthUI() {
  $("#tab-login").onclick = () => setAuthMode("login");
  $("#tab-register").onclick = () => setAuthMode("register");

  $("#auth-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    hideAuthError();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    const btn = $("#auth-submit");
    btn.disabled = true;
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      showAuthError(traducirErrorAuth(err));
    } finally {
      btn.disabled = false;
    }
  });

  $("#auth-forgot").addEventListener("click", async () => {
    hideAuthError();
    const email = $("#auth-email").value.trim();
    if (!email) { showAuthError("Escribe tu correo arriba primero, y luego toca este enlace."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Te enviamos un correo a ${email} para restablecer tu contraseña.`);
    } catch (err) {
      showAuthError(traducirErrorAuth(err));
    }
  });

  $("#auth-google-btn").addEventListener("click", async () => {
    hideAuthError();
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      showAuthError(traducirErrorAuth(err));
    }
  });
}
initAuthUI();

getRedirectResult(auth).catch((err) => {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = traducirErrorAuth(err); el.classList.remove("hidden"); }
});

async function cerrarSesion() {
  if (state.unsubHistorial) { state.unsubHistorial(); state.unsubHistorial = null; }
  await signOut(auth);
}

onAuthStateChanged(auth, async (user) => {
  $("#loading").classList.add("hidden");
  if (user) {
    state.uid = user.uid;
    state.correo = user.email;
    $("#auth-shell").classList.add("hidden");
    $("#app").classList.remove("hidden");
    currentView = todayDayId();
    attachHistorialListener();
    render();
  } else {
    state.uid = null;
    if (state.unsubHistorial) { state.unsubHistorial(); state.unsubHistorial = null; }
    state.historialCache = [];
    $("#app").classList.add("hidden");
    $("#auth-shell").classList.remove("hidden");
  }
});

// ============ FECHA / AUTO-SELECCIÓN DE DÍA ============
function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return toDateStr(new Date()); }
function todayDayId() { return WEEKDAY_TO_DAY[new Date().getDay()]; }

function getDayOrRest(id) { return id === "descanso" ? REST_DAY : DAYS[id]; }

// ============ FIRESTORE: PROGRESO (borrador en curso) ============
async function getProgreso(dayId) {
  if (!state.uid) return null;
  try {
    const snap = await getDoc(doc(db, "usuarios", state.uid, "progreso", dayId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
let saveProgresoTimeout = null;
function saveProgreso(dayId, data) {
  if (!state.uid) return;
  clearTimeout(saveProgresoTimeout);
  updateSyncPill("pending");
  saveProgresoTimeout = setTimeout(() => {
    setDoc(doc(db, "usuarios", state.uid, "progreso", dayId), data)
      .then(() => updateSyncPill("synced"))
      .catch(() => updateSyncPill("offline"));
  }, 400);
}
async function clearProgresoRemote(dayId) {
  if (!state.uid) return;
  try { await deleteDoc(doc(db, "usuarios", state.uid, "progreso", dayId)); } catch {}
}

function updateSyncPill(status) {
  const pill = $("#sync-pill");
  if (!pill) return;
  pill.className = "sync-pill " + status;
  pill.title = status === "synced" ? "Sincronizado" : status === "pending" ? "Guardando…" : "Sin conexión — se guardará al volver";
}

// ============ FIRESTORE: HISTORIAL ============
function attachHistorialListener() {
  const ref = collection(db, "usuarios", state.uid, "entrenamiento");
  state.unsubHistorial = onSnapshot(ref, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    state.historialCache = list;
    updateSyncPill("synced");
    if (currentView === "historial") render();
  }, () => updateSyncPill("offline"));
}

// ============ RENDER DISPATCH ============
function render() {
  renderDayNav();
  const main = $("#main-content");
  const saveBar = $("#save-bar");
  main.innerHTML = "";
  if (currentView === "historial") {
    saveBar.classList.add("hidden");
    renderHistorial(main);
  } else if (currentView === "descanso") {
    renderRestDay(main);
  } else {
    saveBar.classList.remove("hidden");
    renderDay(main, currentView);
  }
}

// ============ DAY NAV ============
function renderDayNav() {
  const nav = $("#day-nav");
  nav.innerHTML = "";
  const today = todayDayId();
  const allIds = [...DAY_ORDER.slice(0, 3), "descanso", ...DAY_ORDER.slice(3)]; // inserta descanso en su posición real (jueves)
  allIds.forEach((id) => {
    const day = getDayOrRest(id);
    const type = DAY_TYPES[day.type];
    const btn = document.createElement("button");
    btn.className = "day-tab" + (currentView === id ? " active" : "");
    btn.style.setProperty("--tab-color", type.color);
    const isToday = today === id;
    btn.innerHTML = `<span class="tab-num">${day.order}</span> <span style="color:${currentView === id ? type.color : ""}">${day.subtitle}</span>${isToday ? '<span class="today-dot"></span>' : ""}`;
    btn.onclick = () => { currentView = id; render(); };
    nav.appendChild(btn);
  });
  const histBtn = document.createElement("button");
  histBtn.className = "day-tab day-tab-history" + (currentView === "historial" ? " active" : "");
  histBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg> Historial`;
  histBtn.onclick = () => { currentView = "historial"; render(); };
  nav.appendChild(histBtn);
}

// ============ REST DAY VIEW ============
function renderRestDay(container) {
  const card = document.createElement("div");
  card.className = "rest-card";
  card.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>
    <h2>Día 4 · Descanso</h2>
    <p style="color:var(--text-faint); font-size:14px;">Recuperación activa</p>
    <ul class="rest-tips">${REST_DAY.tips.map(t => `<li>${t}</li>`).join("")}</ul>
  `;
  container.appendChild(card);

  const saveBar = $("#save-bar");
  saveBar.classList.remove("hidden");
  const btn = $("#btn-complete");
  const label = $("#btn-complete-label");
  const already = state.historialCache.find(e => e.date === todayStr() && e.isRestDay);
  btn.disabled = false;
  btn.classList.toggle("saved", !!already);
  label.textContent = already ? "✓ Descanso ya registrado hoy" : "Guardar registro de descanso";
  btn.onclick = async () => {
    if (already) return;
    await setDoc(doc(db, "usuarios", state.uid, "entrenamiento", todayStr()), {
      dayId: "descanso", dayLabel: "Día 4 · Descanso", dayType: "descanso",
      date: todayStr(), timestamp: new Date().toISOString(),
      isRestDay: true, progressPct: 100, summary: [],
    });
    showToast("Día de descanso registrado");
    render();
  };
}

// ============ DAY VIEW (entrenamiento) ============
async function renderDay(container, dayId) {
  const day = DAYS[dayId];
  const type = DAY_TYPES[day.type];
  const isToday = todayDayId() === dayId;

  container.innerHTML = `<p style="color:var(--text-faint); font-size:14px; text-align:center; padding:30px 0;">Cargando…</p>`;
  const remote = await getProgreso(dayId);
  const saved = remote || { warmup: [], stretch: [], exercises: {} };
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `
    <div class="day-header-title">
      <h1>${day.label}</h1>
      <span class="day-type-name" style="color:${type.color}">${day.subtitle}</span>
      ${isToday ? '<span class="auto-badge">Hoy</span>' : ""}
    </div>
    <div class="day-focus">${day.focus}</div>
    <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%; background:${type.color}"></div></div>
    <div class="progress-label" id="progress-label">0/0 series completadas</div>
  `;
  container.appendChild(header);

  container.appendChild(renderCollapsible("🔥 Calentamiento", day.warmup, saved.warmup || [], (idx, checked) => {
    saved.warmup[idx] = checked;
    saveProgreso(dayId, saved);
  }, `warmup-${dayId}`));

  const list = document.createElement("div");
  list.className = "exercise-list";
  day.exercises.forEach((ex, idx) => {
    list.appendChild(renderExerciseCard(dayId, ex, idx, saved));
  });
  container.appendChild(list);

  container.appendChild(renderCollapsible("🧘 Estiramiento final", day.stretch, saved.stretch || [], (idx, checked) => {
    saved.stretch[idx] = checked;
    saveProgreso(dayId, saved);
  }, `stretch-${dayId}`));

  updateProgress(dayId, saved);

  const btn = $("#btn-complete");
  const label = $("#btn-complete-label");
  btn.classList.remove("saved");
  label.textContent = "Completar sesión y reiniciar";
  btn.onclick = () => completeSession(dayId, saved);
  updateSaveBarState(saved);
}

function renderCollapsible(title, items, savedArr, onToggle, uniqueId) {
  const wrap = document.createElement("div");
  wrap.className = "collapsible";
  wrap.dataset.uid = uniqueId;
  const allDone = items.length > 0 && items.every((_, i) => savedArr[i]);
  if (!allDone) wrap.classList.add("open");
  else wrap.classList.add("auto-closed");

  const summary = document.createElement("div");
  summary.className = "collapsible-summary";
  summary.innerHTML = `<span>${title}${allDone ? '<span class="done-tag">✓ Completo</span>' : ""}</span><svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  summary.onclick = () => wrap.classList.toggle("open");
  wrap.appendChild(summary);

  const body = document.createElement("div");
  body.className = "collapsible-body";
  items.forEach((text, idx) => {
    const checked = !!savedArr[idx];
    const line = document.createElement("label");
    line.className = "check-line" + (checked ? " done" : "");
    line.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span>${text}</span>`;
    line.querySelector("input").onchange = (e) => {
      line.classList.toggle("done", e.target.checked);
      savedArr[idx] = e.target.checked;
      onToggle(idx, e.target.checked);
      const nowAllDone = items.every((_, i) => savedArr[i]);
      const summarySpan = summary.querySelector("span");
      if (nowAllDone) {
        summarySpan.innerHTML = `${title}<span class="done-tag">✓ Completo</span>`;
        setTimeout(() => { wrap.classList.remove("open"); }, 450); // auto-colapsa al completar
      } else {
        summarySpan.textContent = title;
      }
    };
    body.appendChild(line);
  });
  wrap.appendChild(body);
  return wrap;
}

function renderExerciseCard(dayId, ex, idx, saved) {
  const key = `${dayId}-${idx}`;
  let entry = saved.exercises[key];
  if (!entry) {
    entry = ex.unilateral
      ? { side: null, izquierda: Array(ex.sets).fill(false), derecha: Array(ex.sets).fill(false), simul: Array(ex.sets).fill(false) }
      : { checks: Array(ex.sets).fill(false) };
    saved.exercises[key] = entry;
  }

  function isAllDone() {
    if (!ex.unilateral) return entry.checks.filter(Boolean).length === ex.sets;
    if (entry.side === "alternado") return entry.izquierda.filter(Boolean).length === ex.sets && entry.derecha.filter(Boolean).length === ex.sets;
    if (entry.side === "simultaneo") return entry.simul.filter(Boolean).length === ex.sets;
    return false;
  }
  function doneCountLabel() {
    if (!ex.unilateral) return `${entry.checks.filter(Boolean).length}/${ex.sets}`;
    if (entry.side === "alternado") return `${entry.izquierda.filter(Boolean).length}+${entry.derecha.filter(Boolean).length} / ${ex.sets}+${ex.sets}`;
    if (entry.side === "simultaneo") return `${entry.simul.filter(Boolean).length}/${ex.sets}`;
    return `0/${ex.sets}`;
  }

  const card = document.createElement("div");
  card.className = "ex-card" + (isAllDone() ? " done" : "");

  const head = document.createElement("div");
  head.className = "ex-head";
  function refreshHead() {
    head.querySelector(".ex-badge").textContent = isAllDone() ? "✓" : (idx + 1);
    card.classList.toggle("done", isAllDone());
    head.querySelector(".meta").textContent = `${ex.sets} × ${ex.reps}${ex.techo ? " · techo " + ex.techo : ""} · ${doneCountLabel()} series`;
  }
  head.innerHTML = `
    <div class="ex-head-left">
      <div class="ex-badge">${isAllDone() ? "✓" : idx + 1}</div>
      <div class="ex-title">
        <div class="name">${ex.name}</div>
        <div class="meta">${ex.sets} × ${ex.reps}${ex.techo ? " · techo " + ex.techo : ""} · ${doneCountLabel()} series</div>
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
    <div class="ex-controls"></div>
  `;
  body.appendChild(inner);
  const controls = inner.querySelector(".ex-controls");

  head.onclick = () => {
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    head.querySelector(".chev").style.transform = isOpen ? "" : "rotate(180deg)";
  };

  function persist() { saveProgreso(dayId, saved); }

  function checkAutoCollapse() {
    refreshHead();
    updateProgress(dayId, saved);
    updateSaveBarState(saved);
    if (isAllDone()) {
      setTimeout(() => { body.style.display = "none"; head.querySelector(".chev").style.transform = ""; }, 500);
    }
  }

  function renderSetButtons(wrap, arr, timerSuffix) {
    wrap.innerHTML = "";
    const row = document.createElement("div");
    row.className = "set-row";
    for (let i = 0; i < ex.sets; i++) {
      const b = document.createElement("button");
      b.className = "set-btn" + (arr[i] ? " checked" : "");
      b.textContent = i + 1;
      b.onclick = () => {
        arr[i] = !arr[i];
        b.classList.toggle("checked", arr[i]);
        persist();
        checkAutoCollapse();
      };
      row.appendChild(b);
    }
    row.appendChild(renderTimerChip(`${key}${timerSuffix || ""}`, ex.rest));
    wrap.appendChild(row);
  }

  if (!ex.unilateral) {
    const wrap = document.createElement("div");
    controls.appendChild(wrap);
    renderSetButtons(wrap, entry.checks, "");
  } else {
    const choiceWrap = document.createElement("div");
    choiceWrap.className = "side-choice";
    const btnAlt = document.createElement("button");
    btnAlt.className = "side-btn" + (entry.side === "alternado" ? " selected" : "");
    btnAlt.textContent = "Alternado";
    const btnSim = document.createElement("button");
    btnSim.className = "side-btn" + (entry.side === "simultaneo" ? " selected" : "");
    btnSim.textContent = "Simultáneo";
    choiceWrap.appendChild(btnAlt);
    choiceWrap.appendChild(btnSim);
    controls.appendChild(choiceWrap);

    const setsArea = document.createElement("div");
    controls.appendChild(setsArea);

    function renderSetsArea() {
      setsArea.innerHTML = "";
      if (entry.side === "alternado") {
        const [labI, labD] = ex.ladoLabel || ["Izquierda", "Derecha"];
        const wrapI = document.createElement("div");
        wrapI.innerHTML = `<div class="side-group-label">${labI}</div>`;
        setsArea.appendChild(wrapI);
        renderSetButtons(wrapI, entry.izquierda, "-izq");
        const wrapD = document.createElement("div");
        wrapD.innerHTML = `<div class="side-group-label">${labD}</div>`;
        setsArea.appendChild(wrapD);
        renderSetButtons(wrapD, entry.derecha, "-der");
      } else if (entry.side === "simultaneo") {
        const wrapS = document.createElement("div");
        setsArea.appendChild(wrapS);
        renderSetButtons(wrapS, entry.simul, "-sim");
      } else {
        setsArea.innerHTML = `<p style="font-size:13px;color:var(--text-faint);margin:4px 0;">Elige cómo lo vas a hacer para ver las series.</p>`;
      }
    }
    btnAlt.onclick = () => { entry.side = "alternado"; btnAlt.classList.add("selected"); btnSim.classList.remove("selected"); persist(); renderSetsArea(); checkAutoCollapse(); };
    btnSim.onclick = () => { entry.side = "simultaneo"; btnSim.classList.add("selected"); btnAlt.classList.remove("selected"); persist(); renderSetsArea(); checkAutoCollapse(); };
    renderSetsArea();
  }

  card.appendChild(head);
  card.appendChild(body);
  return card;
}

// ============ TIMER — cuenta regresiva azul, alarma continua roja hasta detener manual ============
function renderTimerChip(key, seconds) {
  const wrap = document.createElement("div");
  wrap.dataset.timerKey = key;
  wrap.dataset.seconds = seconds;
  buildTimerIdleUI(wrap, key, seconds);
  return wrap;
}
function buildTimerIdleUI(wrap, key, seconds) {
  wrap.innerHTML = `<button class="timer-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg> Descanso ${seconds}s</button>`;
  wrap.querySelector("button").onclick = () => startTimer(key, seconds);
}

let timerState = { key: null, remaining: 0, total: 0, running: false, finished: false };

function startTimer(key, seconds) {
  stopAlarmLoop();
  activeTimerKey = key;
  timerState = { key, remaining: seconds, total: seconds, running: true, finished: false };
  clearInterval(timerInterval);
  paintTimer();
  timerInterval = setInterval(() => {
    if (!timerState.running) return;
    timerState.remaining--;
    if (timerState.remaining <= 0) {
      timerState.remaining = 0;
      timerState.running = false;
      timerState.finished = true;
      clearInterval(timerInterval);
      startAlarmLoop();
    }
    paintTimer();
  }, 1000);
}

function paintTimer() {
  const wrap = document.querySelector(`[data-timer-key="${CSS.escape(timerState.key)}"]`);
  if (!wrap) return;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const cls = timerState.finished ? "finished" : "running";
  wrap.innerHTML = `
    <div class="timer-active ${cls}">
      <span class="t-num">${timerState.finished ? "¡Listo!" : fmt(timerState.remaining)}</span>
      ${timerState.finished ? "" : `<button data-act="toggle">${timerState.running
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}</button>`}
      <button data-act="reset" title="Reiniciar / detener alarma"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
    </div>`;
  if (!timerState.finished) {
    wrap.querySelector('[data-act="toggle"]').onclick = () => { timerState.running = !timerState.running; paintTimer(); };
  }
  wrap.querySelector('[data-act="reset"]').onclick = () => {
    stopAlarmLoop();
    const seconds = Number(wrap.dataset.seconds);
    clearInterval(timerInterval);
    activeTimerKey = null;
    buildTimerIdleUI(wrap, wrap.dataset.timerKey, seconds);
  };
}

// Alarma: suena a volumen alto y se repite sin parar hasta que el usuario presione "reiniciar".
function startAlarmLoop() {
  playLoudBeep();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  alarmInterval = setInterval(() => {
    playLoudBeep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }, 1600);
}
function stopAlarmLoop() {
  clearInterval(alarmInterval);
  alarmInterval = null;
}
function playLoudBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Varias capas de tono para sonar más fuerte y notorio (el volumen final
    // sigue limitado por el volumen del dispositivo — el navegador no puede
    // forzar el volumen del sistema por razones de seguridad).
    [0, 0.18, 0.36].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 1000; osc.type = "square";
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.34);
    });
  } catch (e) {}
}

// ============ PROGRESS ============
function computeProgress(dayId, saved) {
  const day = DAYS[dayId];
  let total = 0, done = 0;
  day.exercises.forEach((ex, idx) => {
    const entry = saved.exercises[`${dayId}-${idx}`];
    if (!entry) { total += ex.sets; return; }
    if (!ex.unilateral) {
      total += ex.sets;
      done += (entry.checks || []).filter(Boolean).length;
    } else if (entry.side === "alternado") {
      total += ex.sets * 2;
      done += (entry.izquierda || []).filter(Boolean).length + (entry.derecha || []).filter(Boolean).length;
    } else {
      total += ex.sets;
      done += (entry.simul || []).filter(Boolean).length;
    }
  });
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
function updateProgress(dayId, saved) {
  const { done, total, pct } = computeProgress(dayId, saved);
  const fill = $("#progress-fill");
  const label = $("#progress-label");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = `${done}/${total} series completadas`;
}
function updateSaveBarState(saved) {
  const anyProgress = Object.values(saved.exercises || {}).some((e) => {
    if (e.checks) return e.checks.some(Boolean);
    return (e.izquierda || []).some(Boolean) || (e.derecha || []).some(Boolean) || (e.simul || []).some(Boolean);
  }) || (saved.warmup || []).some(Boolean);
  const btn = $("#btn-complete");
  if (btn) btn.disabled = !anyProgress;
}

// ============ COMPLETAR SESIÓN ============
async function completeSession(dayId, saved) {
  const day = DAYS[dayId];
  const summary = day.exercises.map((ex, idx) => {
    const entry = saved.exercises[`${dayId}-${idx}`];
    let done = 0, total = ex.sets;
    if (!entry) { done = 0; }
    else if (!ex.unilateral) { done = (entry.checks || []).filter(Boolean).length; }
    else if (entry.side === "alternado") { total = ex.sets * 2; done = (entry.izquierda || []).filter(Boolean).length + (entry.derecha || []).filter(Boolean).length; }
    else { done = (entry.simul || []).filter(Boolean).length; }
    return { name: ex.name, done, total };
  });
  const totalSets = summary.reduce((a, s) => a + s.total, 0);
  const doneSets = summary.reduce((a, s) => a + s.done, 0);
  const entryDoc = {
    dayId, dayLabel: `${day.label} · ${day.subtitle}`, dayType: day.type,
    date: todayStr(), timestamp: new Date().toISOString(),
    progressPct: totalSets ? Math.round((doneSets / totalSets) * 100) : 0,
    summary, isRestDay: false,
  };
  await setDoc(doc(db, "usuarios", state.uid, "entrenamiento", `${todayStr()}_${dayId}`), entryDoc);
  await clearProgresoRemote(dayId);

  const btn = $("#btn-complete");
  const label = $("#btn-complete-label");
  btn.classList.add("saved");
  label.textContent = "✓ Guardado en el historial";
  showToast("Sesión guardada · plantilla reiniciada");
  setTimeout(() => { if (currentView === dayId) render(); }, 900);
}

// ============ HISTORIAL ============
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
  header.querySelectorAll(".mode-btn").forEach((b) => { b.onclick = () => { historyMode = b.dataset.mode; render(); }; });

  const hist = state.historialCache;
  if (hist.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
      <p><b>Todavía no hay sesiones guardadas.</b></p><p>Completa un día para verlo aquí.</p>`;
    container.appendChild(empty);
    return;
  }

  container.appendChild(renderActivityGraph(hist));

  if (historyMode === "lista") {
    const list = document.createElement("div");
    list.className = "hist-list";
    hist.forEach((entry) => list.appendChild(historyCard(entry)));
    container.appendChild(list);
  } else {
    renderHistorialCalendario(container, hist);
  }
}

function renderActivityGraph(hist) {
  const wrap = document.createElement("div");
  wrap.className = "activity-graph";
  const days = 14;
  const today = new Date();
  const byDate = {};
  hist.forEach(e => { byDate[e.date] = byDate[e.date] || []; byDate[e.date].push(e); });

  const bars = document.createElement("div");
  bars.className = "activity-bars";
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dstr = toDateStr(d);
    const entries = byDate[dstr] || [];
    const barWrap = document.createElement("div");
    barWrap.className = "activity-bar-wrap";
    const bar = document.createElement("div");
    if (entries.length === 0) {
      bar.className = "activity-bar";
      bar.style.height = "4px";
    } else if (entries[0].isRestDay) {
      bar.className = "activity-bar rest";
      bar.style.height = "100%";
    } else {
      const pct = Math.max(entries[0].progressPct, 8);
      bar.className = "activity-bar";
      bar.style.height = pct + "%";
      bar.style.background = (DAY_TYPES[entries[0].dayType] || {}).color || "var(--accent)";
    }
    barWrap.appendChild(bar);
    const lbl = document.createElement("div");
    lbl.className = "activity-bar-label";
    lbl.textContent = ["D","L","M","M","J","V","S"][d.getDay()];
    barWrap.appendChild(lbl);
    bars.appendChild(barWrap);
  }
  wrap.innerHTML = `<div class="activity-graph-title">Últimos 14 días</div>`;
  wrap.appendChild(bars);
  return wrap;
}

function historyCard(entry) {
  const d = new Date(entry.timestamp || entry.date);
  const fecha = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
  const type = DAY_TYPES[entry.dayType] || {};
  const card = document.createElement("div");
  card.className = "hist-card" + (entry.isRestDay ? " rest-entry" : "");
  if (entry.isRestDay) {
    card.innerHTML = `
      <div class="hist-card-top">
        <div>
          <div class="hist-day-name" style="color:${type.color || "inherit"}">😴 Día de descanso</div>
          <div class="hist-date">${fecha}</div>
        </div>
        <div class="hist-pct rest">Registrado</div>
      </div>`;
    return card;
  }
  card.innerHTML = `
    <div class="hist-card-top">
      <div>
        <div class="hist-day-name" style="color:${type.color || "inherit"}">${entry.dayLabel}</div>
        <div class="hist-date">${fecha}</div>
      </div>
      <div class="hist-pct ${entry.progressPct === 100 ? "full" : "partial"}">${entry.progressPct}%</div>
    </div>
    <div class="hist-chips">
      ${(entry.summary || []).map(s => `<span class="hist-chip ${s.done < s.total ? "incomplete" : ""}">${s.name.length > 22 ? s.name.slice(0,22)+"…" : s.name} ${s.done}/${s.total}</span>`).join("")}
    </div>
  `;
  return card;
}

function renderHistorialCalendario(container, hist) {
  const byDate = {};
  hist.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });

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
  for (let i = 0; i < startOffset; i++) { const c = document.createElement("div"); c.className = "cal-cell empty"; grid.appendChild(c); }

  const detailBox = document.createElement("div");
  detailBox.className = "cal-day-detail";
  detailBox.style.display = "none";

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month+1)}-${pad2(day)}`;
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
        detailBox.innerHTML = `<div style="font-size:13.5px;font-weight:700;margin-bottom:8px;">${new Date(dateStr+"T00:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</div>`;
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
  toastTimeout = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ============ MENU SHEET ============
function openSheet() {
  $("#sheet-account").textContent = state.correo ? `Sesión iniciada: ${state.correo}` : "";
  $("#menu-sheet").classList.remove("hidden");
}
function closeSheet() { $("#menu-sheet").classList.add("hidden"); }
$("#btn-menu").onclick = openSheet;
$("#sheet-backdrop").onclick = closeSheet;
$("#btn-logout").onclick = async () => { closeSheet(); await cerrarSesion(); };

$("#btn-export-json").onclick = () => {
  const data = { historial: state.historialCache, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `respaldo-ozren-${todayStr()}.json`);
  closeSheet();
  showToast("Respaldo JSON descargado");
};

$("#btn-export-xlsx").onclick = () => {
  const rows = [];
  state.historialCache.forEach((e) => {
    const d = new Date(e.timestamp || e.date);
    if (e.isRestDay) {
      rows.push({ Fecha: d.toLocaleDateString("es-CO"), Día: "Descanso", "% Sesión": 100, Ejercicio: "—", "Series completadas": "—", "Series totales": "—" });
      return;
    }
    (e.summary || []).forEach((s) => {
      rows.push({
        Fecha: d.toLocaleDateString("es-CO"), Día: e.dayLabel, "% Sesión": e.progressPct,
        Ejercicio: s.name, "Series completadas": s.done, "Series totales": s.total,
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Historial");
  XLSX.writeFile(wb, `historial-ozren-${todayStr()}.xlsx`);
  closeSheet();
  showToast("Excel descargado");
};

$("#file-import").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed.historial || !Array.isArray(parsed.historial)) throw new Error("formato inválido");
      for (const entry of parsed.historial) {
        const id = entry.id || `${entry.date}_${entry.dayId || "x"}`;
        await setDoc(doc(db, "usuarios", state.uid, "entrenamiento", id), entry);
      }
      closeSheet();
      showToast(`Importado: ${parsed.historial.length} sesiones`);
    } catch (err) {
      showToast("Archivo inválido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};

$("#btn-clear-all").onclick = async () => {
  if (!confirm("¿Borrar todo tu historial guardado en la nube? Esta acción no se puede deshacer. Exporta un respaldo antes si no estás seguro.")) return;
  const snap = await getDocs(collection(db, "usuarios", state.uid, "entrenamiento"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  closeSheet();
  showToast("Historial borrado");
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ SERVICE WORKER ============
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

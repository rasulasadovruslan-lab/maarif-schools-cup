// Maarif Schools Cup - app logic + Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";

// ============ CONFIG ============
const DEBUG = false;
const ADMIN_EMAIL = "rasulasadovruslan@gmail.com";
const ADMIN_USERNAME = "Admin_Sarxan";
const DATA_APP_ID = "1:673595498743:web:347b8ddf759b3531c273f2";
const RECAPTCHA_ENTERPRISE_KEY = "6Le8VxkuAAAAAqsLag1oTRDhYz6ZBlYFkrcCFzn"; // You put this in earlier

const firebaseConfig = {
  apiKey: "AIzaSyBXN22tYVXUAR-L4rMszdoZGxaDWsKElrY",
  authDomain: "maarif-football-project.firebaseapp.com",
  projectId: "maarif-football-project",
  storageBucket: "maarif-football-project.firebasestorage.app",
  messagingSenderId: "673595498743",
  appId: "1:673595498743:web:8b457ed7ce903c0ec273f2",
  measurementId: "G-D7P3E3R0Y3",
};

// ============ SPLASH ANIMATION ============
const N = "http://www.w3.org/2000/svg",
  cx = 250,
  cy = 230;
function P(r, d) {
  const a = (d * Math.PI) / 180;
  return (
    (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1)
  );
}
function buildAnimationSegments() {
  const g = document.getElementById("segs");
  if (!g) return;
  g.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const a = i * 45 - 90;
    const d =
      "M" +
      P(40, a - 22.5) +
      " Q" +
      P(95, a - 14) +
      " " +
      P(125, a - 17) +
      " A125 125 0 0 1 " +
      P(125, a + 17) +
      " Q" +
      P(95, a + 14) +
      " " +
      P(40, a + 22.5) +
      " L" +
      P(62, a) +
      " Z";
    const p = document.createElementNS(N, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "seg");
    p.setAttribute("fill", i % 2 ? "#00b5e2" : "#ffffff");
    p.style.animationDelay = i * 0.09 + "s";
    g.appendChild(p);
  }
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 40 : 62,
      a = ((i * 22.5 - 90) * Math.PI) / 180;
    pts.push(
      (cx + r * Math.cos(a)).toFixed(1) +
        "," +
        (cy + r * Math.sin(a)).toFixed(1),
    );
  }
  const starp = document.getElementById("starp");
  if (starp) starp.setAttribute("points", pts.join(" "));
}
buildAnimationSegments();

// ============ FIREBASE + APP CHECK ============
let app,
  db = null,
  auth = null;
let isFirebaseReady = false;
let remoteLoaded = false;
let listenerStarted = false;

try {
  app = initializeApp(firebaseConfig);
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
  db = getFirestore(app);
  auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      isFirebaseReady = false;
      signInAnonymously(auth).catch((err) => {
        if (DEBUG) console.warn("Anonymous auth failed:", err.code);
        showToast(
          "Cloud sign-in failed — enable Anonymous auth in Firebase",
          "error",
        );
      });
      return;
    }
    isFirebaseReady = true;
    appState.isAdmin =
      !user.isAnonymous &&
      (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!listenerStarted) {
      listenerStarted = true;
      setupFirestoreListener();
    }
    try {
      updateAuthUI();
    } catch (_) {
      /* UI not ready */
    }
  });
} catch (e) {
  if (DEBUG) console.warn("Firebase init error:", e);
}

// ============ STATE ============
let appState = {
  theme: "dark",
  isAdmin: false,
  classes: [
    { id: "c9a", name: "9A Class", color: "#00b5e2" },
    { id: "c9b", name: "9B Class", color: "#3b82f6" },
    { id: "c10a", name: "10A Class", color: "#10b981" },
    { id: "c10b", name: "10B Class", color: "#f59e0b" },
    { id: "c11a", name: "11A Class", color: "#ec4899" },
    { id: "c11b", name: "11B Class", color: "#8b5cf6" },
    { id: "c8a", name: "8A Class", color: "#06b6d4" },
    { id: "c7a", name: "7A Class", color: "#f97316" },
  ],
  players: [],
  weeks: [],
  news: [],
};

// ============ FIRESTORE ============
function setupFirestoreListener() {
  if (!db) return;
  const docRef = doc(
    db,
    "artifacts",
    DATA_APP_ID,
    "public_data",
    "tournament_state",
  );
  onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const r = snap.data();
        if (r) {
          try {
            appState.classes = r.classes || appState.classes;
            appState.players = r.players || [];
            appState.weeks = r.weeks || [];
            appState.news = r.news || [];
            remoteLoaded = true;
            localStorage.setItem(
              "maarif_cup_premier_v3",
              JSON.stringify(appState),
            );
            renderAll();
          } catch (err) {
            if (DEBUG) console.error("Cloud parse error:", err);
          }
        }
      } else {
        remoteLoaded = true;
        saveState();
      }
    },
    (error) => {
      if (DEBUG) console.warn("Firestore listener error:", error.code);
      showToast("Cloud read blocked — check Firestore rules", "error");
    },
  );
}

async function saveState() {
  localStorage.setItem("maarif_cup_premier_v3", JSON.stringify(appState));
  if (db && isFirebaseReady) {
    try {
      const docRef = doc(
        db,
        "artifacts",
        DATA_APP_ID,
        "public_data",
        "tournament_state",
      );
      await setDoc(
        docRef,
        {
          classes: appState.classes,
          players: appState.players,
          weeks: appState.weeks,
          news: appState.news || [],
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err) {
      if (DEBUG) console.warn("Cloud save error:", err.code);
      showToast(
        "Saved locally only — cloud blocked (" + (err.code || "error") + ")",
        "error",
      );
    }
  }
}

function loadState() {
  const saved = remoteLoaded
    ? null
    : localStorage.getItem("maarif_cup_premier_v3");
  if (saved) {
    try {
      const p = JSON.parse(saved);
      appState.classes = p.classes || appState.classes;
      appState.players = p.players || [];
      appState.weeks = p.weeks || [];
      appState.news = p.news || [];
    } catch (_) {}
  }
}

// ============ UTILITIES ============
function escapeHtml(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function showToast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `p-4 rounded-2xl shadow-xl text-sm font-semibold text-white pointer-events-auto flex items-center gap-3 transition duration-300 transform translate-y-2 opacity-0 ${
    type === "error"
      ? "bg-red-500"
      : type === "success"
        ? "bg-emerald-500"
        : "bg-maarifAccent text-maarifBg"
  }`;
  t.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i><span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.remove("translate-y-2", "opacity-0"));
  setTimeout(() => {
    t.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// Custom Confirm Modal
window.showConfirm = function (message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const msgEl = document.getElementById("customConfirmMessage");
    const btnOk = document.getElementById("btnConfirmOk");
    const btnCancel = document.getElementById("btnConfirmCancel");

    msgEl.textContent = message;
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Remove old listeners to prevent multiple fires
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnOk.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      resolve(true);
    });

    newBtnCancel.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      resolve(false);
    });
  });
};

function renderAll() {
  renderLeagueTable();
  renderFixtures();
  renderClasses();
  renderScorers();
  renderAssists();
  updateAdminStats();
  renderNews();
  renderInjuryReport();
}

// ============ STANDINGS ============
function calculateStandings() {
  const s = {};
  appState.classes.forEach((c) => {
    s[c.id] = {
      id: c.id,
      name: c.name,
      color: c.color,
      P: 0,
      W: 0,
      D: 0,
      L: 0,
      GF: 0,
      GA: 0,
      GD: 0,
      PTS: 0,
    };
  });
  appState.weeks.forEach((w) => {
    (w.matches || []).forEach((m) => {
      if (
        m.homeScore != null &&
        m.awayScore != null &&
        m.homeScore !== "" &&
        m.awayScore !== ""
      ) {
        const hs = parseInt(m.homeScore, 10),
          as = parseInt(m.awayScore, 10);
        if (s[m.homeTeamId] && s[m.awayTeamId]) {
          const h = s[m.homeTeamId],
            a = s[m.awayTeamId];
          h.P++;
          a.P++;
          h.GF += hs;
          h.GA += as;
          a.GF += as;
          a.GA += hs;
          h.GD = h.GF - h.GA;
          a.GD = a.GF - a.GA;
          if (hs > as) {
            h.W++;
            h.PTS += 3;
            a.L++;
          } else if (as > hs) {
            a.W++;
            a.PTS += 3;
            h.L++;
          } else {
            h.D++;
            h.PTS += 1;
            a.D++;
            a.PTS += 1;
          }
        }
      }
    });
  });
  return Object.values(s).sort(
    (a, b) => b.PTS - a.PTS || b.GD - a.GD || b.GF - a.GF,
  );
}

function renderLeagueTable() {
  const tb = document.getElementById("leagueTableBody");
  if (!tb) return;
  const data = calculateStandings();
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-400 text-sm">No classes registered yet.</td></tr>`;
    return;
  }
  tb.innerHTML = data
    .map(
      (t, i) => `
    <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition">
      <td class="py-4 px-4 text-center font-bold text-xs ${i === 0 ? "text-amber-400" : "text-gray-500"}">${i + 1}</td>
      <td class="py-4 px-4 font-semibold flex items-center gap-3">
        <span class="w-3 h-3 rounded-full shadow-sm" style="background-color:${escapeHtml(t.color || "#00b5e2")}"></span>
        <span class="text-sm">${escapeHtml(t.name)}</span>
      </td>
      <td class="py-4 px-3 text-center text-sm font-medium">${t.P}</td>
      <td class="py-4 px-3 text-center text-sm font-medium text-emerald-500">${t.W}</td>
      <td class="py-4 px-3 text-center text-sm font-medium text-amber-500">${t.D}</td>
      <td class="py-4 px-3 text-center text-sm font-medium text-red-500">${t.L}</td>
      <td class="py-4 px-3 text-center text-sm text-gray-500">${t.GF}</td>
      <td class="py-4 px-3 text-center text-sm text-gray-500">${t.GA}</td>
      <td class="py-4 px-3 text-center text-sm font-medium ${t.GD > 0 ? "text-emerald-500" : t.GD < 0 ? "text-red-500" : "text-gray-500"}">${t.GD > 0 ? "+" + t.GD : t.GD}</td>
      <td class="py-4 px-4 text-center font-black text-maarifAccent text-base">${t.PTS}</td>
    </tr>`,
    )
    .join("");
}

// ============ FIXTURES ============
function renderFixtures() {
  const c = document.getElementById("fixturesListContainer");
  if (!c) return;
  if (!appState.weeks?.length) {
    c.innerHTML = `<div class="p-10 text-center glass-panel rounded-3xl text-gray-400 text-sm">No match weeks added yet. ${appState.isAdmin ? 'Click "Add Week" to get started.' : ""}</div>`;
    return;
  }
  c.innerHTML = appState.weeks
    .map((w) => {
      const mh = w.matches?.length
        ? w.matches
            .map((m) => {
              const h = appState.classes.find((x) => x.id === m.homeTeamId);
              const a = appState.classes.find((x) => x.id === m.awayTeamId);
              const has =
                m.homeScore != null &&
                m.awayScore != null &&
                m.homeScore !== "" &&
                m.awayScore !== "";
              return `<div class="card-bg p-4 rounded-2xl flex items-center justify-between gap-4">
        <div class="flex-1 text-right font-semibold text-sm truncate">${escapeHtml(h?.name || "Unknown")}</div>
        <div class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5 text-center shrink-0 min-w-[80px]">
          ${has ? `<span class="font-black text-sm tracking-widest text-maarifAccent">${escapeHtml(m.homeScore)} - ${escapeHtml(m.awayScore)}</span>` : `<span class="text-xs text-gray-400 font-semibold tracking-wider">VS</span>`}
        </div>
        <div class="flex-1 text-left font-semibold text-sm truncate">${escapeHtml(a?.name || "Unknown")}</div>
        ${
          appState.isAdmin
            ? `<div class="flex items-center gap-2 shrink-0 ml-2">
          <button data-action="edit-match" data-week="${escapeHtml(w.id)}" data-match="${escapeHtml(m.id)}" class="w-8 h-8 rounded-lg bg-maarifAccent/10 text-maarifAccent hover:bg-maarifAccent/20 flex items-center justify-center transition"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
          <button data-action="delete-match" data-week="${escapeHtml(w.id)}" data-match="${escapeHtml(m.id)}" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`
            : ""
        }
      </div>`;
            })
            .join("")
        : `<p class="text-sm text-gray-400 italic p-2">No matches added to this week.</p>`;
      return `<div class="glass-panel p-6 rounded-3xl space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-base text-maarifAccent flex items-center gap-2"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(w.title)}</h3>
        ${
          appState.isAdmin
            ? `<div class="flex items-center gap-3">
          <button data-action="add-match" data-week="${escapeHtml(w.id)}" class="px-4 py-2 rounded-xl bg-maarifAccent/10 text-maarifAccent hover:bg-maarifAccent/20 text-xs font-bold transition">+ Add Match</button>
          <button data-action="delete-week" data-week="${escapeHtml(w.id)}" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`
            : ""
        }
      </div>
      <div class="space-y-3">${mh}</div>
    </div>`;
    })
    .join("");
}

// ============ CLASSES ============
function renderClasses() {
  const g = document.getElementById("classesGrid");
  if (!g) return;
  const q = (
    document.getElementById("classSearchInput")?.value || ""
  ).toLowerCase();
  const filtered = appState.classes.filter((c) =>
    c.name.toLowerCase().includes(q),
  );
  if (!filtered.length) {
    g.innerHTML = `<div class="col-span-2 p-10 text-center glass-panel rounded-3xl text-gray-400 text-sm">No class teams found.</div>`;
    return;
  }
  g.innerHTML = filtered
    .map((c) => {
      const ps = appState.players.filter((p) => p.teamId === c.id);
      const ph = ps.length
        ? ps
            .map(
              (p) => `
      <div class="flex items-center justify-between gap-3 py-2 px-3 rounded-xl text-sm ${p.injured ? "bg-red-500/10 border border-red-500/20" : "bg-gray-50 dark:bg-white/5"}">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-6 h-6 shrink-0 rounded-lg bg-maarifAccent/10 text-maarifAccent font-bold text-[10px] flex items-center justify-center">#${escapeHtml(p.number || 10)}</span>
          <span class="font-semibold text-gray-700 dark:text-gray-200 truncate">${escapeHtml(p.name)}</span>${p.injured ? injuryBadge() : ""}
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium">
          <span>⚽ ${escapeHtml(p.goals || 0)}</span><span>🅰️ ${escapeHtml(p.assists || 0)}</span>
          ${
            appState.isAdmin
              ? `<button data-action="toggle-injury" data-player="${escapeHtml(p.id)}" title="${p.injured ? "Mark fit" : "Mark injured"}" class="w-8 h-8 rounded-lg flex items-center justify-center transition ${p.injured ? "bg-red-500 text-white shadow-sm" : "bg-gray-200 dark:bg-white/10 text-gray-500 hover:bg-red-500/20 hover:text-red-500"}"><i class="fa-solid fa-bandage text-xs"></i></button>
          <button data-action="delete-player" data-player="${escapeHtml(p.id)}" class="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/10 text-gray-500 hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-xmark text-xs"></i></button>`
              : ""
          }
        </div>
      </div>`,
            )
            .join("")
        : `<p class="text-sm text-gray-400 italic py-2">No players registered yet.</p>`;
      return `<div class="glass-panel p-6 rounded-3xl space-y-4">
      <div class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-4">
        <div class="flex items-center gap-3"><span class="w-4 h-4 rounded-full shadow-sm" style="background-color:${escapeHtml(c.color)}"></span><h3 class="font-bold text-base">${escapeHtml(c.name)}</h3></div>
        ${
          appState.isAdmin
            ? `<div class="flex items-center gap-2">
          <button data-action="add-player" data-team="${escapeHtml(c.id)}" data-team-name="${escapeHtml(c.name)}" class="px-3 py-1.5 rounded-lg bg-maarifAccent/10 text-maarifAccent hover:bg-maarifAccent/20 text-xs font-bold transition">+ Player</button>
          <button data-action="delete-class" data-class="${escapeHtml(c.id)}" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`
            : ""
        }
      </div>
      <div class="space-y-2 max-h-56 overflow-y-auto pr-2">${ph}</div>
    </div>`;
    })
    .join("");
}

// ============ SCORERS / ASSISTS ============
function renderScorers() {
  const tb = document.getElementById("scorersTableBody");
  if (!tb) return;
  const sorted = [...appState.players].sort(
    (a, b) =>
      (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0),
  );
  if (!sorted.length || sorted.every((p) => !p.goals)) {
    tb.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-400 text-sm">No goals recorded yet.</td></tr>`;
    return;
  }
  tb.innerHTML = sorted
    .filter((p) => (p.goals || 0) > 0)
    .map((p, i) => {
      const t = appState.classes.find((c) => c.id === p.teamId);
      return `<tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition text-sm">
      <td class="py-4 px-4 text-center font-bold ${i === 0 ? "text-amber-400" : "text-gray-500"}">${i + 1}</td>
      <td class="py-4 px-4 font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(p.name)} <span class="text-gray-400 font-normal ml-1">#${escapeHtml(p.number)}</span>${p.injured ? injuryIcon() : ""}</td>
      <td class="py-4 px-4 text-gray-500 font-medium">${escapeHtml(t?.name || "Unknown")}</td>
      <td class="py-4 px-4 text-center font-black text-maarifAccent text-base">${escapeHtml(p.goals || 0)}</td>
      <td class="py-4 px-4 text-center text-gray-500 font-medium">${escapeHtml(p.assists || 0)}</td>
    </tr>`;
    })
    .join("");
}

function renderAssists() {
  const tb = document.getElementById("assistsTableBody");
  if (!tb) return;
  const sorted = [...appState.players].sort(
    (a, b) =>
      (b.assists || 0) - (a.assists || 0) || (b.goals || 0) - (a.goals || 0),
  );
  if (!sorted.length || sorted.every((p) => !p.assists)) {
    tb.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-400 text-sm">No assists recorded yet.</td></tr>`;
    return;
  }
  tb.innerHTML = sorted
    .filter((p) => (p.assists || 0) > 0)
    .map((p, i) => {
      const t = appState.classes.find((c) => c.id === p.teamId);
      return `<tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition text-sm">
      <td class="py-4 px-4 text-center font-bold ${i === 0 ? "text-amber-400" : "text-gray-500"}">${i + 1}</td>
      <td class="py-4 px-4 font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(p.name)} <span class="text-gray-400 font-normal ml-1">#${escapeHtml(p.number)}</span>${p.injured ? injuryIcon() : ""}</td>
      <td class="py-4 px-4 text-gray-500 font-medium">${escapeHtml(t?.name || "Unknown")}</td>
      <td class="py-4 px-4 text-center font-black text-maarifAccent text-base">${escapeHtml(p.assists || 0)}</td>
      <td class="py-4 px-4 text-center text-gray-500 font-medium">${escapeHtml(p.goals || 0)}</td>
    </tr>`;
    })
    .join("");
}

// ============ NEWS / INJURIES ============
function injuryBadge() {
  return `<span class="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold uppercase tracking-wide ml-2"><i class="fa-solid fa-bandage"></i>Injured</span>`;
}
function injuryIcon() {
  return ` <i class="fa-solid fa-bandage text-red-500 text-xs ml-2" title="Injured"></i>`;
}

const NEWS_CATEGORIES = {
  news: {
    label: "News",
    icon: "fa-newspaper",
    cls: "bg-maarifAccent/10 text-maarifAccent border-maarifAccent/20",
  },
  match: {
    label: "Match Report",
    icon: "fa-futbol",
    cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  injury: {
    label: "Injury Update",
    icon: "fa-bandage",
    cls: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  announcement: {
    label: "Announcement",
    icon: "fa-bullhorn",
    cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
};

function formatNewsDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderNews() {
  const c = document.getElementById("newsListContainer");
  if (!c) return;
  const list = Array.isArray(appState.news) ? appState.news : [];
  if (!list.length) {
    c.innerHTML = `<div class="p-10 text-center glass-panel rounded-3xl text-gray-400 text-sm"><i class="fa-regular fa-newspaper text-3xl mb-3 block opacity-50"></i>No news yet. ${appState.isAdmin ? 'Click "Post News" to publish the first update.' : "Check back soon!"}</div>`;
    return;
  }
  const sorted = [...list].sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  c.innerHTML = sorted
    .map((n) => {
      const cat = NEWS_CATEGORIES[n.category] || NEWS_CATEGORIES.news;
      const id = escapeHtml(n.id);
      return `<article class="glass-panel p-6 rounded-3xl space-y-4 ${n.pinned ? "ring-2 ring-maarifAccent/30" : ""}">
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${cat.cls}"><i class="fa-solid ${cat.icon}"></i>${cat.label}</span>
        ${n.pinned ? `<span class="inline-flex items-center gap-1.5 text-[10px] font-bold text-maarifAccent"><i class="fa-solid fa-thumbtack"></i>Pinned</span>` : ""}
        <span class="ml-auto text-[11px] font-medium text-gray-400">${formatNewsDate(n.createdAt)}</span>
      </div>
      <h3 class="font-bold text-lg leading-snug break-words text-gray-900 dark:text-white">${escapeHtml(n.title)}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line break-words leading-relaxed">${escapeHtml(n.body)}</p>
      ${
        appState.isAdmin
          ? `<div class="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
        <button data-action="toggle-news-pin" data-news="${id}" class="px-3 py-1.5 rounded-lg bg-maarifAccent/10 text-maarifAccent hover:bg-maarifAccent/20 text-xs font-semibold transition"><i class="fa-solid fa-thumbtack mr-1.5"></i>${n.pinned ? "Unpin" : "Pin"}</button>
        <button data-action="edit-news" data-news="${id}" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-semibold transition"><i class="fa-solid fa-pen-to-square mr-1.5"></i>Edit</button>
        <button data-action="delete-news" data-news="${id}" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold transition"><i class="fa-solid fa-trash mr-1.5"></i>Delete</button>
      </div>`
          : ""
      }
    </article>`;
    })
    .join("");
}

function renderInjuryReport() {
  const l = document.getElementById("injuryReportList");
  const cnt = document.getElementById("injuryCount");
  const injured = appState.players.filter((p) => p.injured);
  if (cnt) cnt.textContent = injured.length;
  if (!l) return;
  if (!injured.length) {
    l.innerHTML = `<p class="text-sm text-gray-500 font-medium italic py-2">No injuries reported. Everyone is fit! 💪</p>`;
    return;
  }
  const tn = (p) => appState.classes.find((c) => c.id === p.teamId)?.name || "";
  l.innerHTML = [...injured]
    .sort(
      (a, b) =>
        tn(a).localeCompare(tn(b)) ||
        String(a.name).localeCompare(String(b.name)),
    )
    .map((p) => {
      const t = appState.classes.find((c) => c.id === p.teamId);
      return `<div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
      <div class="min-w-0">
        <div class="font-bold text-sm text-red-500 truncate">${escapeHtml(p.name)} <span class="text-red-400/70 font-medium ml-1">#${escapeHtml(p.number || 10)}</span></div>
        <div class="flex items-center gap-2 text-[11px] font-medium text-gray-500 mt-1"><span class="w-2 h-2 rounded-full shrink-0" style="background-color:${escapeHtml(t?.color || "#888")}"></span><span class="truncate">${escapeHtml(t?.name || "Unknown")}</span></div>
      </div>
      ${appState.isAdmin ? `<button data-action="toggle-injury" data-player="${escapeHtml(p.id)}" class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 text-xs font-bold transition">Mark fit</button>` : ""}
    </div>`;
    })
    .join("");
}

// ============ ADMIN STATS ============
function updateAdminStats() {
  const cc = document.getElementById("adminClassCount");
  const mc = document.getElementById("adminMatchCount");
  if (cc) cc.textContent = appState.classes.length;
  if (mc) {
    let t = 0;
    appState.weeks.forEach((w) => (t += (w.matches || []).length));
    mc.textContent = t;
  }
}

// ============ AUTH UI ============
function updateAuthUI() {
  const dot = document.getElementById("authDot");
  const text = document.getElementById("authStatusText");
  const btn = document.getElementById("btnAuthAction");
  const btnMob = document.getElementById("btnAuthActionMob");
  const inline = document.getElementById("adminLoginPrompt");
  const dash = document.getElementById("adminDashboardContent");
  const fixCtrl = document.getElementById("fixtureAdminControls");
  const clsCtrl = document.getElementById("classAdminControls");

  if (appState.isAdmin) {
    if (dot)
      dot.className =
        "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500";
    if (text) text.textContent = "Admin_Sarxan";
    if (btn) btn.textContent = "Logout";
    if (btnMob) btnMob.textContent = "Logout";
    if (inline) inline.classList.add("hidden");
    if (dash) dash.classList.remove("hidden");
    if (fixCtrl) fixCtrl.classList.remove("hidden");
    if (clsCtrl) clsCtrl.classList.remove("hidden");
  } else {
    if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400";
    if (text) text.textContent = "Guest";
    if (btn) btn.textContent = "Admin Login";
    if (btnMob) btnMob.textContent = "Admin";
    if (inline) inline.classList.remove("hidden");
    if (dash) dash.classList.add("hidden");
    if (fixCtrl) fixCtrl.classList.add("hidden");
    if (clsCtrl) clsCtrl.classList.add("hidden");
  }
  document
    .getElementById("newsAdminControls")
    ?.classList.toggle("hidden", !appState.isAdmin);
  renderFixtures();
  renderClasses();
  renderNews();
  renderInjuryReport();
}

async function loginAdmin(user, pass) {
  const id = (user || "").trim();
  const email = id.includes("@")
    ? id
    : id.toLowerCase() === ADMIN_USERNAME.toLowerCase()
      ? ADMIN_EMAIL
      : null;
  if (!email || !pass) {
    showToast("Invalid credentials!", "error");
    return false;
  }
  if (!auth) {
    showToast("Firebase not ready — refresh", "error");
    return false;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if ((cred.user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      showToast("This account is not an admin", "error");
      return false;
    }
    appState.isAdmin = true;
    updateAuthUI();
    showToast("Logged in as Admin_Sarxan", "success");
    return true;
  } catch (err) {
    const msgs = {
      "auth/invalid-credential": "Wrong username or password",
      "auth/wrong-password": "Wrong username or password",
      "auth/user-not-found": "Wrong username or password",
      "auth/invalid-email": "Invalid email",
      "auth/too-many-requests": "Too many attempts — wait a few minutes",
      "auth/network-request-failed": "Network error",
      "auth/operation-not-allowed": "Enable Email/Password in Firebase Console",
    };
    showToast(msgs[err.code] || "Login failed", "error");
    return false;
  }
}

async function logoutAdmin() {
  appState.isAdmin = false;
  updateAuthUI();
  try {
    await signOut(auth);
  } catch (_) {}
  showToast("Logged out successfully");
}

// ============ MODAL OPENERS ============
function openAddMatchModal(weekId) {
  const week = appState.weeks.find((w) => w.id === weekId);
  if (!week) return;
  document.getElementById("matchWeekId").value = weekId;
  document.getElementById("addMatchModalTitle").textContent =
    `Add Match to ${week.title}`;
  const opts = appState.classes
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`,
    )
    .join("");
  document.getElementById("matchHomeTeam").innerHTML = opts;
  document.getElementById("matchAwayTeam").innerHTML = opts;
  if (appState.classes.length > 1)
    document.getElementById("matchAwayTeam").selectedIndex = 1;
  document.getElementById("addMatchModal").classList.remove("hidden");
  document.getElementById("addMatchModal").classList.add("flex");
}

function openAddPlayerModal(teamId, teamName) {
  document.getElementById("playerTeamId").value = teamId;
  document.getElementById("addPlayerModalTeamName").textContent = teamName;
  document.getElementById("addPlayerModal").classList.remove("hidden");
  document.getElementById("addPlayerModal").classList.add("flex");
}

function openEditMatchModal(weekId, matchId) {
  const week = appState.weeks.find((w) => w.id === weekId);
  if (!week) return;
  const match = (week.matches || []).find((m) => m.id === matchId);
  if (!match) return;
  const h = appState.classes.find((c) => c.id === match.homeTeamId);
  const a = appState.classes.find((c) => c.id === match.awayTeamId);
  document.getElementById("editMatchWeekId").value = weekId;
  document.getElementById("editMatchId").value = matchId;
  document.getElementById("modalHomeName").textContent = h?.name || "Home";
  document.getElementById("modalAwayName").textContent = a?.name || "Away";
  document.getElementById("modalHomeScore").value = match.homeScore ?? "";
  document.getElementById("modalAwayScore").value = match.awayScore ?? "";
  const sec = document.getElementById("scorersAssignSection");
  const list = document.getElementById("scorersAssignList");
  const players = appState.players.filter(
    (p) => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId,
  );
  if (players.length) {
    sec.classList.remove("hidden");
    list.innerHTML = players
      .map(
        (p) => `
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl text-sm ${p.injured ? "bg-red-500/10 border border-red-500/20" : "bg-gray-50 dark:bg-white/5"}">
        <div class="flex items-center gap-3 min-w-0">
          <button data-action="toggle-injury" data-player="${escapeHtml(p.id)}" class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition ${p.injured ? "bg-red-500 text-white shadow-sm" : "bg-gray-200 dark:bg-white/10 text-gray-500 hover:bg-red-500/20 hover:text-red-500"}"><i class="fa-solid fa-bandage text-xs"></i></button>
          <span class="font-semibold truncate max-w-[140px] text-gray-800 dark:text-gray-200">${escapeHtml(p.name)}</span>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-gray-400">G:</span><button data-action="adj-stat" data-player="${escapeHtml(p.id)}" data-stat="goals" data-delta="-1" class="w-6 h-6 rounded bg-red-500/10 text-red-500 font-bold flex items-center justify-center hover:bg-red-500/20 transition">-</button><span class="font-bold w-4 text-center text-sm">${escapeHtml(p.goals || 0)}</span><button data-action="adj-stat" data-player="${escapeHtml(p.id)}" data-stat="goals" data-delta="1" class="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center hover:bg-emerald-500/20 transition">+</button></div>
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-gray-400">A:</span><button data-action="adj-stat" data-player="${escapeHtml(p.id)}" data-stat="assists" data-delta="-1" class="w-6 h-6 rounded bg-red-500/10 text-red-500 font-bold flex items-center justify-center hover:bg-red-500/20 transition">-</button><span class="font-bold w-4 text-center text-sm">${escapeHtml(p.assists || 0)}</span><button data-action="adj-stat" data-player="${escapeHtml(p.id)}" data-stat="assists" data-delta="1" class="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center hover:bg-emerald-500/20 transition">+</button></div>
        </div>
      </div>`,
      )
      .join("");
  } else {
    sec.classList.add("hidden");
  }
  document.getElementById("editMatchModal").classList.remove("hidden");
  document.getElementById("editMatchModal").classList.add("flex");
}

function openNewsModal(newsId) {
  const item = newsId
    ? (appState.news || []).find((n) => n.id === newsId)
    : null;
  document.getElementById("newsIdInput").value = item ? item.id : "";
  document.getElementById("newsTitleInput").value = item ? item.title : "";
  document.getElementById("newsCategoryInput").value = item
    ? item.category || "news"
    : "news";
  document.getElementById("newsBodyInput").value = item ? item.body : "";
  document.getElementById("newsPinInput").checked = item
    ? !!item.pinned
    : false;
  document.getElementById("newsModalTitle").textContent = item
    ? "Edit News"
    : "Post News";
  document.getElementById("newsModal").classList.remove("hidden");
  document.getElementById("newsModal").classList.add("flex");
}

// ============ EVENT DELEGATION ============
async function handleAction(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "edit-match")
    openEditMatchModal(el.dataset.week, el.dataset.match);
  else if (action === "delete-match")
    await deleteMatch(el.dataset.week, el.dataset.match);
  else if (action === "add-match") openAddMatchModal(el.dataset.week);
  else if (action === "delete-week") await deleteWeek(el.dataset.week);
  else if (action === "toggle-injury") toggleInjury(el.dataset.player);
  else if (action === "delete-player") await deletePlayer(el.dataset.player);
  else if (action === "add-player")
    openAddPlayerModal(el.dataset.team, el.dataset.teamName);
  else if (action === "delete-class") await deleteClass(el.dataset.class);
  else if (action === "toggle-news-pin") toggleNewsPin(el.dataset.news);
  else if (action === "edit-news") openNewsModal(el.dataset.news);
  else if (action === "delete-news") await deleteNews(el.dataset.news);
  else if (action === "adj-stat")
    adjStat(el.dataset.player, el.dataset.stat, parseInt(el.dataset.delta, 10));
}

// ============ CRUD FUNCTIONS (Using Custom Confirm) ============
function toggleInjury(playerId) {
  if (!appState.isAdmin) return;
  const p = appState.players.find((x) => x.id === playerId);
  if (!p) return;
  p.injured = !p.injured;
  saveState();
  renderAll();
  showToast(`${p.name} marked as ${p.injured ? "injured" : "fit"}`, "info");
  const modal = document.getElementById("editMatchModal");
  if (modal && !modal.classList.contains("hidden")) {
    const w = document.getElementById("editMatchWeekId").value;
    const m = document.getElementById("editMatchId").value;
    if (w && m) openEditMatchModal(w, m);
  }
}

function adjStat(playerId, stat, delta) {
  const p = appState.players.find((x) => x.id === playerId);
  if (p) {
    p[stat] = Math.max(0, (p[stat] || 0) + delta);
    saveState();
    renderScorers();
    renderAssists();
    renderClasses();
    const w = document.getElementById("editMatchWeekId").value;
    const m = document.getElementById("editMatchId").value;
    if (w && m) openEditMatchModal(w, m);
  }
}

async function deleteMatch(weekId, matchId) {
  const ok = await window.showConfirm("Delete this match?");
  if (!ok) return;
  const w = appState.weeks.find((x) => x.id === weekId);
  if (w) {
    w.matches = (w.matches || []).filter((m) => m.id !== matchId);
    saveState();
    renderLeagueTable();
    renderFixtures();
    updateAdminStats();
    showToast("Match deleted", "info");
  }
}

async function deleteWeek(weekId) {
  const ok = await window.showConfirm(
    "Delete this entire week and all its matches?",
  );
  if (!ok) return;
  appState.weeks = appState.weeks.filter((w) => w.id !== weekId);
  saveState();
  renderLeagueTable();
  renderFixtures();
  updateAdminStats();
  showToast("Week deleted", "info");
}

async function deleteClass(classId) {
  const ok = await window.showConfirm(
    "Delete this class team and all its players?",
  );
  if (!ok) return;
  appState.classes = appState.classes.filter((c) => c.id !== classId);
  appState.players = appState.players.filter((p) => p.teamId !== classId);
  saveState();
  renderLeagueTable();
  renderClasses();
  renderScorers();
  renderAssists();
  updateAdminStats();
  showToast("Class team deleted", "info");
}

async function deletePlayer(playerId) {
  const ok = await window.showConfirm("Remove this player from the squad?");
  if (!ok) return;
  appState.players = appState.players.filter((p) => p.id !== playerId);
  saveState();
  renderClasses();
  renderScorers();
  renderAssists();
  showToast("Player removed", "info");
}

async function deleteNews(newsId) {
  if (!appState.isAdmin) return;
  const ok = await window.showConfirm("Delete this news post?");
  if (!ok) return;
  appState.news = (appState.news || []).filter((n) => n.id !== newsId);
  saveState();
  renderNews();
  showToast("News deleted", "info");
}

function toggleNewsPin(newsId) {
  if (!appState.isAdmin) return;
  const item = (appState.news || []).find((n) => n.id === newsId);
  if (!item) return;
  item.pinned = !item.pinned;
  saveState();
  renderNews();
}

// ============ TAB SWITCHING ============
function switchTab(tabId) {
  [
    "league",
    "news",
    "fixtures",
    "classes",
    "scorers",
    "assists",
    "admin",
  ].forEach((t) => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (el) el.classList.add("hidden");
    if (btn)
      btn.className =
        "px-4 py-2 rounded-xl text-xs font-semibold transition text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 whitespace-nowrap shrink-0";
  });
  const a = document.getElementById(`tab-${tabId}`);
  const b = document.getElementById(`tabBtn-${tabId}`);
  if (a) a.classList.remove("hidden");
  if (b)
    b.className =
      "px-4 py-2 rounded-xl text-xs font-semibold transition bg-maarifAccent text-maarifBg shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0";
}

// ============ INIT ============
function enterPortal() {
  const s = document.getElementById("splashScreen");
  const m = document.getElementById("mainApp");
  s.style.opacity = "0";
  setTimeout(() => {
    s.classList.add("hidden");
    m.classList.remove("hidden");
    m.classList.add("flex");
    initApp();
  }, 700);
}

function initApp() {
  loadState();
  updateAuthUI();
  renderAll();

  [
    "league",
    "news",
    "fixtures",
    "classes",
    "scorers",
    "assists",
    "admin",
  ].forEach((t) => {
    document
      .getElementById(`tabBtn-${t}`)
      ?.addEventListener("click", () => switchTab(t));
  });

  document.getElementById("btnAuthAction")?.addEventListener("click", () => {
    if (appState.isAdmin) logoutAdmin();
    else {
      document.getElementById("loginModal").classList.remove("hidden");
      document.getElementById("loginModal").classList.add("flex");
    }
  });
  document.getElementById("btnAuthActionMob")?.addEventListener("click", () => {
    if (appState.isAdmin) logoutAdmin();
    else {
      document.getElementById("loginModal").classList.remove("hidden");
      document.getElementById("loginModal").classList.add("flex");
    }
  });
  document
    .getElementById("btnCloseLoginModal")
    ?.addEventListener("click", () =>
      document.getElementById("loginModal").classList.add("hidden"),
    );

  document
    .getElementById("formModalLogin")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("modalLoginUsername").value;
      const p = document.getElementById("modalLoginPassword").value;
      const sb = e.target.querySelector('[type="submit"]');
      if (sb) sb.disabled = true;
      const ok = await loginAdmin(u, p);
      if (sb) sb.disabled = false;
      if (ok) document.getElementById("loginModal").classList.add("hidden");
    });

  document
    .getElementById("formInlineLogin")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("inlineLoginUsername").value;
      const p = document.getElementById("inlineLoginPassword").value;
      const sb = e.target.querySelector('[type="submit"]');
      if (sb) sb.disabled = true;
      await loginAdmin(u, p);
      if (sb) sb.disabled = false;
    });

  document
    .getElementById("btnAdminLogout")
    ?.addEventListener("click", logoutAdmin);

  document
    .getElementById("btnOpenAddWeekModal")
    ?.addEventListener("click", () => {
      document.getElementById("addWeekModal").classList.remove("hidden");
      document.getElementById("addWeekModal").classList.add("flex");
    });
  document
    .getElementById("btnCloseAddWeekModal")
    ?.addEventListener("click", () =>
      document.getElementById("addWeekModal").classList.add("hidden"),
    );

  document.getElementById("formAddWeek")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = document.getElementById("weekTitleInput").value.trim();
    if (t) {
      appState.weeks.push({ id: "w_" + Date.now(), title: t, matches: [] });
      saveState();
      renderFixtures();
      updateAdminStats();
      document.getElementById("addWeekModal").classList.add("hidden");
      document.getElementById("weekTitleInput").value = "";
      showToast("Week added", "success");
    }
  });

  document
    .getElementById("btnOpenAddClassModal")
    ?.addEventListener("click", () => {
      document.getElementById("addClassModal").classList.remove("hidden");
      document.getElementById("addClassModal").classList.add("flex");
    });
  document.getElementById("btnAdminAddClass")?.addEventListener("click", () => {
    document.getElementById("addClassModal").classList.remove("hidden");
    document.getElementById("addClassModal").classList.add("flex");
  });
  document
    .getElementById("btnCloseAddClassModal")
    ?.addEventListener("click", () =>
      document.getElementById("addClassModal").classList.add("hidden"),
    );

  document.getElementById("formAddClass")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = document.getElementById("classNameInput").value.trim();
    const c = document.getElementById("classColorInput").value;
    if (n) {
      appState.classes.push({ id: "c_" + Date.now(), name: n, color: c });
      saveState();
      renderLeagueTable();
      renderClasses();
      updateAdminStats();
      document.getElementById("addClassModal").classList.add("hidden");
      document.getElementById("classNameInput").value = "";
      showToast("Class team created", "success");
    }
  });

  document
    .getElementById("btnCloseAddMatchModal")
    ?.addEventListener("click", () =>
      document.getElementById("addMatchModal").classList.add("hidden"),
    );

  document.getElementById("formAddMatch")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const wId = document.getElementById("matchWeekId").value;
    const h = document.getElementById("matchHomeTeam").value;
    const a = document.getElementById("matchAwayTeam").value;
    const hs = document.getElementById("matchHomeScore").value;
    const as = document.getElementById("matchAwayScore").value;
    if (h === a) {
      showToast("Home and Away must differ!", "error");
      return;
    }
    const w = appState.weeks.find((x) => x.id === wId);
    if (w) {
      w.matches = w.matches || [];
      w.matches.push({
        id: "m_" + Date.now(),
        homeTeamId: h,
        awayTeamId: a,
        homeScore: hs !== "" ? parseInt(hs, 10) : null,
        awayScore: as !== "" ? parseInt(as, 10) : null,
      });
      saveState();
      renderLeagueTable();
      renderFixtures();
      updateAdminStats();
      document.getElementById("addMatchModal").classList.add("hidden");
      showToast("Match scheduled", "success");
    }
  });

  document
    .getElementById("btnCloseEditMatchModal")
    ?.addEventListener("click", () =>
      document.getElementById("editMatchModal").classList.add("hidden"),
    );

  document.getElementById("formEditMatch")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const wId = document.getElementById("editMatchWeekId").value;
    const mId = document.getElementById("editMatchId").value;
    const hs = document.getElementById("modalHomeScore").value;
    const as = document.getElementById("modalAwayScore").value;
    const w = appState.weeks.find((x) => x.id === wId);
    if (w) {
      const m = (w.matches || []).find((x) => x.id === mId);
      if (m) {
        m.homeScore = parseInt(hs, 10);
        m.awayScore = parseInt(as, 10);
        saveState();
        renderLeagueTable();
        renderFixtures();
        document.getElementById("editMatchModal").classList.add("hidden");
        showToast("Match score saved", "success");
      }
    }
  });

  document
    .getElementById("btnCloseAddPlayerModal")
    ?.addEventListener("click", () =>
      document.getElementById("addPlayerModal").classList.add("hidden"),
    );

  document.getElementById("formAddPlayer")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = document.getElementById("playerTeamId").value;
    const n = document.getElementById("playerNameInput").value.trim();
    const num =
      parseInt(document.getElementById("playerNumberInput").value, 10) || 10;
    if (n && t) {
      appState.players.push({
        id: "p_" + Date.now(),
        teamId: t,
        name: n,
        number: num,
        goals: 0,
        assists: 0,
      });
      saveState();
      renderClasses();
      document.getElementById("addPlayerModal").classList.add("hidden");
      document.getElementById("playerNameInput").value = "";
      showToast("Player added", "success");
    }
  });

  document
    .getElementById("btnClearFixtures")
    ?.addEventListener("click", async () => {
      const ok = await window.showConfirm(
        "Clear all scheduled weeks and matches? This cannot be undone.",
      );
      if (ok) {
        appState.weeks = [];
        saveState();
        renderLeagueTable();
        renderFixtures();
        updateAdminStats();
        showToast("Fixtures cleared", "info");
      }
    });

  document
    .getElementById("btnAdminSaveCloud")
    ?.addEventListener("click", async () => {
      await saveState();
      showToast("All changes saved to cloud!", "success");
    });

  document
    .getElementById("btnAdminResetAll")
    ?.addEventListener("click", async () => {
      const ok = await window.showConfirm(
        "RESET ALL DATA? This cannot be undone.",
      );
      if (ok) {
        appState.weeks = [];
        appState.players = [];
        appState.classes = [
          { id: "c9a", name: "9A Class", color: "#00b5e2" },
          { id: "c9b", name: "9B Class", color: "#3b82f6" },
          { id: "c10a", name: "10A Class", color: "#10b981" },
          { id: "c10b", name: "10B Class", color: "#f59e0b" },
        ];
        saveState();
        renderAll();
        showToast("Tournament data reset", "info");
      }
    });

  document.getElementById("btnExportHtml")?.addEventListener("click", () => {
    const blob = new Blob([document.documentElement.outerHTML], {
      type: "text/html",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "index.html";
    a.click();
    showToast("Downloaded updated index.html!", "success");
  });

  document
    .getElementById("btnOpenNewsModal")
    ?.addEventListener("click", () => openNewsModal());
  document
    .getElementById("btnCloseNewsModal")
    ?.addEventListener("click", () => {
      document.getElementById("newsModal").classList.add("hidden");
      document.getElementById("newsModal").classList.remove("flex");
    });

  document.getElementById("formNews")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!appState.isAdmin) return;
    const id = document.getElementById("newsIdInput").value;
    const title = document.getElementById("newsTitleInput").value.trim();
    const body = document.getElementById("newsBodyInput").value.trim();
    const category = document.getElementById("newsCategoryInput").value;
    const pinned = document.getElementById("newsPinInput").checked;
    if (!title || !body) {
      showToast("Please add a title and some text.", "error");
      return;
    }
    appState.news = Array.isArray(appState.news) ? appState.news : [];
    if (id) {
      const item = appState.news.find((n) => n.id === id);
      if (item) Object.assign(item, { title, body, category, pinned });
    } else {
      appState.news.push({
        id: "n_" + Date.now(),
        title,
        body,
        category,
        pinned,
        createdAt: new Date().toISOString(),
      });
    }
    saveState();
    renderNews();
    document.getElementById("newsModal").classList.add("hidden");
    document.getElementById("newsModal").classList.remove("flex");
    showToast(id ? "News updated" : "News posted", "success");
  });

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    document.documentElement.classList.toggle("light");
    appState.theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  };
  document
    .getElementById("btnToggleTheme")
    ?.addEventListener("click", toggleTheme);
  document
    .getElementById("btnToggleThemeMob")
    ?.addEventListener("click", toggleTheme);

  document
    .getElementById("classSearchInput")
    ?.addEventListener("input", renderClasses);
  document.getElementById("btnRefreshLeague")?.addEventListener("click", () => {
    renderLeagueTable();
    showToast("Standings refreshed", "info");
  });
}

// ============ SPLASH BUTTON ============
document
  .getElementById("btnEnterPortal")
  ?.addEventListener("click", enterPortal);

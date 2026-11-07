// Maarif Schools Cup - app logic + Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const N = 'http://www.w3.org/2000/svg', cx = 250, cy = 230;
function P(r, d) {
  const a = d * Math.PI / 180;
  return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
}
function buildAnimationSegments() {
  const g = document.getElementById('segs');
  if (!g) return;
  g.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const a = i * 45 - 90;
    const d = 'M' + P(40, a - 22.5) + ' Q' + P(95, a - 14) + ' ' + P(125, a - 17) + ' A125 125 0 0 1 ' + P(125, a + 17) + ' Q' + P(95, a + 14) + ' ' + P(40, a + 22.5) + ' L' + P(62, a) + ' Z';
    const p = document.createElementNS(N, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'seg');
    p.setAttribute('fill', i % 2 ? '#00b5e2' : '#ffffff');
    p.style.animationDelay = (i * 0.09) + 's';
    g.appendChild(p);
  }
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 40 : 62, a = (i * 22.5 - 90) * Math.PI / 180;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  const starp = document.getElementById('starp');
  if (starp) starp.setAttribute('points', pts.join(' '));
}
buildAnimationSegments();

function enterPortal() {
  const splash = document.getElementById('splashScreen');
  const main = document.getElementById('mainApp');
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.classList.add('hidden');
    main.classList.remove('hidden');
    main.classList.add('flex');
    initApp();
  }, 700);
}

let appState = {
  theme: 'dark',
  isAdmin: false,
  classes: [
    { id: 'c9a', name: '9A Class', color: '#00b5e2' },
    { id: 'c9b', name: '9B Class', color: '#3b82f6' },
    { id: 'c10a', name: '10A Class', color: '#10b981' },
    { id: 'c10b', name: '10B Class', color: '#f59e0b' },
    { id: 'c11a', name: '11A Class', color: '#ec4899' },
    { id: 'c11b', name: '11B Class', color: '#8b5cf6' },
    { id: 'c8a', name: '8A Class', color: '#06b6d4' },
    { id: 'c7a', name: '7A Class', color: '#f97316' }
  ],
  players: [],
  weeks: []
};

const firebaseConfig = {
  apiKey: "AIzaSyBXN22tYVXUAR-L4rMszdoZGxaDWsKElrY",
  authDomain: "maarif-football-project.firebaseapp.com",
  projectId: "maarif-football-project",
  storageBucket: "maarif-football-project.firebasestorage.app",
  messagingSenderId: "673595498743",
  appId: "1:673595498743:web:347b8ddf759b3531c273f2",
  measurementId: "G-6YF0SENEZY"
};

let db = null;
let auth = null;
let isFirebaseReady = false;
let remoteLoaded = false; // true once cloud data arrived, so stale localStorage can't overwrite it

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  signInAnonymously(auth).then(() => {
    isFirebaseReady = true;
    setupFirestoreListener();
  }).catch(err => {
    console.warn("Anonymous auth failed, using local state:", err);
    showToast('Cloud sign-in failed (' + (err.code || 'error') + ') - enable Anonymous auth in Firebase', 'error');
  });
} catch (e) {
  console.warn('Firebase init error, fallback to local storage:', e);
}

function setupFirestoreListener() {
  if (!db) return;
  const docRef = doc(db, 'artifacts', firebaseConfig.appId, 'public_data', 'tournament_state');

  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const remote = docSnap.data();
      if (remote) {
        try {
          appState.classes = remote.classes || appState.classes;
          appState.players = remote.players || [];
          appState.weeks = remote.weeks || [];
          remoteLoaded = true;
          localStorage.setItem('maarif_cup_premier_v3', JSON.stringify(appState));

          renderLeagueTable();
          renderFixtures();
          renderClasses();
          renderScorers();
          renderAssists();
          updateAdminStats();
        } catch (err) {
          console.error("Cloud parse error:", err);
        }
      }
    } else {
      remoteLoaded = true;
      saveState();
    }
  }, (error) => {
    console.warn('Firestore listener error:', error.code, error.message);
    showToast('Cloud read blocked (' + (error.code || 'error') + ') - check Firestore rules', 'error');
  });
}

async function saveState() {
  localStorage.setItem('maarif_cup_premier_v3', JSON.stringify(appState));
  if (db && isFirebaseReady) {
    try {
      const docRef = doc(db, 'artifacts', firebaseConfig.appId, 'public_data', 'tournament_state');
      await setDoc(docRef, {
        classes: appState.classes,
        players: appState.players,
        weeks: appState.weeks,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Cloud save error:", err.code, err.message);
      showToast('Saved on this device only - cloud blocked (' + (err.code || 'error') + ')', 'error');
    }
  }
}

function loadState() {
  const saved = remoteLoaded ? null : localStorage.getItem('maarif_cup_premier_v3');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appState.classes = parsed.classes || appState.classes;
      appState.players = parsed.players || [];
      appState.weeks = parsed.weeks || [];
    } catch (e) {
      console.warn("Failed to parse local storage:", e);
    }
  }
  if (sessionStorage.getItem('maarif_admin_active') === 'true') {
    appState.isAdmin = true;
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `p-3 rounded-xl shadow-xl text-xs font-semibold text-white pointer-events-auto flex items-center gap-2 transition duration-300 transform translate-y-2 opacity-0 ${
    type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-emerald-500' : 'bg-maarifAccent text-maarifBg'
  }`;
  toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function calculateStandings() {
  const standings = {};
  appState.classes.forEach(c => {
    standings[c.id] = { id: c.id, name: c.name, color: c.color, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0 };
  });

  appState.weeks.forEach(w => {
    (w.matches || []).forEach(m => {
      if (m.homeScore !== null && m.awayScore !== null && m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== '' && m.awayScore !== '') {
        const hs = parseInt(m.homeScore, 10);
        const as = parseInt(m.awayScore, 10);

        if (standings[m.homeTeamId] && standings[m.awayTeamId]) {
          const h = standings[m.homeTeamId];
          const a = standings[m.awayTeamId];

          h.P++; a.P++;
          h.GF += hs; h.GA += as;
          a.GF += as; a.GA += hs;
          h.GD = h.GF - h.GA;
          a.GD = a.GF - a.GA;

          if (hs > as) {
            h.W++; h.PTS += 3;
            a.L++;
          } else if (as > hs) {
            a.W++; a.PTS += 3;
            h.L++;
          } else {
            h.D++; h.PTS += 1;
            a.D++; a.PTS += 1;
          }
        }
      }
    });
  });

  return Object.values(standings).sort((a, b) => b.PTS - a.PTS || b.GD - a.GD || b.GF - a.GF);
}

function renderLeagueTable() {
  const tbody = document.getElementById('leagueTableBody');
  if (!tbody) return;
  const data = calculateStandings();

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-6 text-center text-gray-400">No classes registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((t, idx) => `
    <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition">
      <td class="py-3 px-3 text-center font-bold text-xs ${idx === 0 ? 'text-amber-400' : ''}">${idx + 1}</td>
      <td class="py-3 px-3 font-semibold flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${t.color || '#00b5e2'}"></span>
        ${t.name}
      </td>
      <td class="py-3 px-2 text-center">${t.P}</td>
      <td class="py-3 px-2 text-center text-emerald-400 font-medium">${t.W}</td>
      <td class="py-3 px-2 text-center text-amber-400 font-medium">${t.D}</td>
      <td class="py-3 px-2 text-center text-red-400 font-medium">${t.L}</td>
      <td class="py-3 px-2 text-center text-gray-400">${t.GF}</td>
      <td class="py-3 px-2 text-center text-gray-400">${t.GA}</td>
      <td class="py-3 px-2 text-center font-medium ${t.GD > 0 ? 'text-emerald-400' : t.GD < 0 ? 'text-red-400' : ''}">${t.GD > 0 ? '+' + t.GD : t.GD}</td>
      <td class="py-3 px-3 text-center font-black text-maarifAccent text-sm">${t.PTS}</td>
    </tr>
  `).join('');
}

function renderFixtures() {
  const container = document.getElementById('fixturesListContainer');
  if (!container) return;

  if (!appState.weeks || appState.weeks.length === 0) {
    container.innerHTML = `<div class="p-8 text-center glass-panel rounded-2xl text-gray-400 text-xs sm:text-sm">No match weeks added yet. ${appState.isAdmin ? 'Click "Add Week" to get started.' : ''}</div>`;
    return;
  }

  container.innerHTML = appState.weeks.map(w => {
    const matchesHtml = (w.matches && w.matches.length > 0) ? w.matches.map(m => {
      const homeTeam = appState.classes.find(c => c.id === m.homeTeamId);
      const awayTeam = appState.classes.find(c => c.id === m.awayTeamId);
      const hasScore = m.homeScore !== null && m.awayScore !== null && m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== '' && m.awayScore !== '';

      return `
        <div class="card-bg p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-2 sm:gap-4">
          <div class="flex-1 text-right font-semibold text-xs sm:text-sm truncate">
            ${homeTeam ? homeTeam.name : 'Unknown'}
          </div>
          <div class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-center shrink-0 min-w-[70px]">
            ${hasScore ? `<span class="font-black text-xs sm:text-sm tracking-widest text-maarifAccent">${m.homeScore} - ${m.awayScore}</span>` : `<span class="text-[10px] text-gray-400 uppercase font-medium">VS</span>`}
          </div>
          <div class="flex-1 text-left font-semibold text-xs sm:text-sm truncate">
            ${awayTeam ? awayTeam.name : 'Unknown'}
          </div>
          ${appState.isAdmin ? `
            <div class="flex items-center gap-1 shrink-0 ml-1">
              <button onclick="window.openEditMatchModal('${w.id}', '${m.id}')" class="p-1.5 rounded-lg bg-maarifAccent/10 text-maarifAccent hover:bg-maarifAccent/20 text-xs">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button onclick="window.deleteMatch('${w.id}', '${m.id}')" class="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('') : `<p class="text-xs text-gray-400 italic p-2">No matches added to this week.</p>`;

    return `
      <div class="glass-panel p-4 sm:p-5 rounded-2xl space-y-3 border">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm sm:text-base text-maarifAccent flex items-center gap-2">
            <i class="fa-solid fa-calendar-day"></i> ${w.title}
          </h3>
          ${appState.isAdmin ? `
            <div class="flex items-center gap-2">
              <button onclick="window.openAddMatchModal('${w.id}')" class="px-3 py-1 rounded-lg bg-maarifAccent/20 text-maarifAccent hover:bg-maarifAccent/30 text-xs font-bold transition">
                + Add Match
              </button>
              <button onclick="window.deleteWeek('${w.id}')" class="p-1 text-red-400 hover:text-red-500 text-xs">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="space-y-2">${matchesHtml}</div>
      </div>
    `;
  }).join('');
}

function renderClasses() {
  const grid = document.getElementById('classesGrid');
  if (!grid) return;

  const searchTerm = (document.getElementById('classSearchInput')?.value || '').toLowerCase();
  const filtered = appState.classes.filter(c => c.name.toLowerCase().includes(searchTerm));

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-2 p-8 text-center glass-panel rounded-2xl text-gray-400 text-xs sm:text-sm">No class teams found.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => {
    const teamPlayers = appState.players.filter(p => p.teamId === c.id);
    const playersHtml = teamPlayers.length > 0 ? teamPlayers.map(p => `
      <div class="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-black/10 dark:bg-white/5 text-xs">
        <div class="flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-maarifAccent/20 text-maarifAccent font-bold text-[10px] flex items-center justify-center">#${p.number || 10}</span>
          <span class="font-medium">${p.name}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-gray-400">
          <span>⚽ ${p.goals || 0}</span>
          <span>🅰️ ${p.assists || 0}</span>
          ${appState.isAdmin ? `
            <button onclick="window.deletePlayer('${p.id}')" class="text-red-400 hover:text-red-500 ml-1">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('') : `<p class="text-[11px] text-gray-400 italic py-1">No players registered yet.</p>`;

    return `
      <div class="glass-panel p-4 sm:p-5 rounded-2xl space-y-3 border">
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="w-3.5 h-3.5 rounded-full" style="background-color: ${c.color}"></span>
            <h3 class="font-bold text-sm sm:text-base">${c.name}</h3>
          </div>
          ${appState.isAdmin ? `
            <div class="flex items-center gap-2">
              <button onclick="window.openAddPlayerModal('${c.id}', '${c.name}')" class="px-2.5 py-1 rounded-lg bg-maarifAccent/20 text-maarifAccent hover:bg-maarifAccent/30 text-xs font-bold transition">
                + Player
              </button>
              <button onclick="window.deleteClass('${c.id}')" class="text-red-400 hover:text-red-500 text-xs p-1">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">${playersHtml}</div>
      </div>
    `;
  }).join('');
}

function renderScorers() {
  const tbody = document.getElementById('scorersTableBody');
  if (!tbody) return;

  const sorted = [...appState.players].sort((a, b) => (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0));

  if (sorted.length === 0 || sorted.every(p => !p.goals)) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400 text-xs">No goals recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.filter(p => (p.goals || 0) > 0).map((p, idx) => {
    const team = appState.classes.find(c => c.id === p.teamId);
    return `
      <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition text-xs">
        <td class="py-3 px-3 text-center font-bold ${idx === 0 ? 'text-amber-400' : ''}">${idx + 1}</td>
        <td class="py-3 px-3 font-semibold">${p.name} (#${p.number})</td>
        <td class="py-3 px-3 text-gray-400">${team ? team.name : 'Unknown'}</td>
        <td class="py-3 px-3 text-center font-black text-maarifAccent text-sm">${p.goals || 0}</td>
        <td class="py-3 px-3 text-center text-gray-400">${p.assists || 0}</td>
      </tr>
    `;
  }).join('');
}

function renderAssists() {
  const tbody = document.getElementById('assistsTableBody');
  if (!tbody) return;

  const sorted = [...appState.players].sort((a, b) => (b.assists || 0) - (a.assists || 0) || (b.goals || 0) - (b.goals || 0));

  if (sorted.length === 0 || sorted.every(p => !p.assists)) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400 text-xs">No assists recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.filter(p => (p.assists || 0) > 0).map((p, idx) => {
    const team = appState.classes.find(c => c.id === p.teamId);
    return `
      <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition text-xs">
        <td class="py-3 px-3 text-center font-bold ${idx === 0 ? 'text-amber-400' : ''}">${idx + 1}</td>
        <td class="py-3 px-3 font-semibold">${p.name} (#${p.number})</td>
        <td class="py-3 px-3 text-gray-400">${team ? team.name : 'Unknown'}</td>
        <td class="py-3 px-3 text-center font-black text-maarifAccent text-sm">${p.assists || 0}</td>
        <td class="py-3 px-3 text-center text-gray-400">${p.goals || 0}</td>
      </tr>
    `;
  }).join('');
}

function updateAdminStats() {
  const classCount = document.getElementById('adminClassCount');
  const matchCount = document.getElementById('adminMatchCount');
  if (classCount) classCount.textContent = appState.classes.length;
  if (matchCount) {
    let total = 0;
    appState.weeks.forEach(w => total += (w.matches || []).length);
    matchCount.textContent = total;
  }
}

function switchTab(tabId) {
  ['league', 'fixtures', 'classes', 'scorers', 'assists', 'admin'].forEach(t => {
    const tabEl = document.getElementById(`tab-${t}`);
    const btnEl = document.getElementById(`tabBtn-${t}`);
    if (tabEl) tabEl.classList.add('hidden');
    if (btnEl) {
      btnEl.className = "px-3 py-2 rounded-lg text-xs font-semibold transition text-gray-600 dark:text-gray-300 hover:text-maarifAccent flex items-center gap-1.5 whitespace-nowrap shrink-0";
    }
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = "px-3 py-2 rounded-lg text-xs font-semibold transition bg-maarifAccent text-maarifBg shadow flex items-center gap-1.5 whitespace-nowrap shrink-0";
  }
}

function updateAuthUI() {
  const dot = document.getElementById('authDot');
  const text = document.getElementById('authStatusText');
  const btn = document.getElementById('btnAuthAction');
  const btnMob = document.getElementById('btnAuthActionMob');
  const inlinePrompt = document.getElementById('adminLoginPrompt');
  const dashboard = document.getElementById('adminDashboardContent');
  const fixtureAdminControls = document.getElementById('fixtureAdminControls');
  const classAdminControls = document.getElementById('classAdminControls');

  if (appState.isAdmin) {
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400";
    if (text) text.textContent = "Admin_Sarxan";
    if (btn) btn.textContent = "Logout";
    if (btnMob) btnMob.textContent = "Logout";
    if (inlinePrompt) inlinePrompt.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    if (fixtureAdminControls) fixtureAdminControls.classList.remove('hidden');
    if (classAdminControls) classAdminControls.classList.remove('hidden');
  } else {
    if (dot) dot.className = "w-2 h-2 rounded-full bg-gray-400";
    if (text) text.textContent = "Guest";
    if (btn) btn.textContent = "Admin Login";
    if (btnMob) btnMob.textContent = "Admin";
    if (inlinePrompt) inlinePrompt.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    if (fixtureAdminControls) fixtureAdminControls.classList.add('hidden');
    if (classAdminControls) classAdminControls.classList.add('hidden');
  }

  renderFixtures();
  renderClasses();
}

async function loginAdmin(email, pass) {
  if (!auth) {
    showToast('Firebase Auth not initialized!', 'error');
    return false;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    appState.isAdmin = true;
    sessionStorage.setItem('maarif_admin_active', 'true');
    saveState();
    updateAuthUI();
    showToast('Logged in successfully as Admin!', 'success');
    return true;
  } catch (err) {
    console.error("Firebase Login Error:", err);
    showToast('Invalid email or password!', 'error');
    return false;
  }
}

function logoutAdmin() {
  if (auth) {
    signOut(auth).then(() => {
      signInAnonymously(auth);
    }).catch(console.warn);
  }
  appState.isAdmin = false;
  sessionStorage.removeItem('maarif_admin_active');
  saveState();
  updateAuthUI();
  showToast('Logged out successfully');
}

window.openAddMatchModal = function(weekId) {
  const week = appState.weeks.find(w => w.id === weekId);
  if (!week) return;
  document.getElementById('matchWeekId').value = weekId;
  document.getElementById('addMatchModalTitle').textContent = `Add Match to ${week.title}`;

  const homeSel = document.getElementById('matchHomeTeam');
  const awaySel = document.getElementById('matchAwayTeam');
  const opts = appState.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  homeSel.innerHTML = opts;
  awaySel.innerHTML = opts;
  if (appState.classes.length > 1) awaySel.selectedIndex = 1;

  document.getElementById('addMatchModal').classList.remove('hidden');
  document.getElementById('addMatchModal').classList.add('flex');
};

window.openAddPlayerModal = function(teamId, teamName) {
  document.getElementById('playerTeamId').value = teamId;
  document.getElementById('addPlayerModalTeamName').textContent = teamName;
  document.getElementById('addPlayerModal').classList.remove('hidden');
  document.getElementById('addPlayerModal').classList.add('flex');
};

window.openEditMatchModal = function(weekId, matchId) {
  const week = appState.weeks.find(w => w.id === weekId);
  if (!week) return;
  const match = (week.matches || []).find(m => m.id === matchId);
  if (!match) return;

  const homeTeam = appState.classes.find(c => c.id === match.homeTeamId);
  const awayTeam = appState.classes.find(c => c.id === match.awayTeamId);

  document.getElementById('editMatchWeekId').value = weekId;
  document.getElementById('editMatchId').value = matchId;
  document.getElementById('modalHomeName').textContent = homeTeam ? homeTeam.name : 'Home';
  document.getElementById('modalAwayName').textContent = awayTeam ? awayTeam.name : 'Away';
  document.getElementById('modalHomeScore').value = match.homeScore !== undefined ? match.homeScore : '';
  document.getElementById('modalAwayScore').value = match.awayScore !== undefined ? match.awayScore : '';

  const assignSection = document.getElementById('scorersAssignSection');
  const assignList = document.getElementById('scorersAssignList');
  const teamPlayers = appState.players.filter(p => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId);

  if (teamPlayers.length > 0) {
    assignSection.classList.remove('hidden');
    assignList.innerHTML = teamPlayers.map(p => `
      <div class="flex items-center justify-between p-2 rounded-xl bg-black/10 dark:bg-white/5 text-xs">
        <span class="font-semibold truncate max-w-[120px]">${p.name}</span>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-gray-400">G:</span>
            <button type="button" onclick="window.adjStat('${p.id}', 'goals', -1)" class="w-5 h-5 rounded bg-red-500/20 text-red-400 font-bold flex items-center justify-center">-</button>
            <span class="font-bold w-4 text-center">${p.goals || 0}</span>
            <button type="button" onclick="window.adjStat('${p.id}', 'goals', 1)" class="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">+</button>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-gray-400">A:</span>
            <button type="button" onclick="window.adjStat('${p.id}', 'assists', -1)" class="w-5 h-5 rounded bg-red-500/20 text-red-400 font-bold flex items-center justify-center">-</button>
            <span class="font-bold w-4 text-center">${p.assists || 0}</span>
            <button type="button" onclick="window.adjStat('${p.id}', 'assists', 1)" class="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">+</button>
          </div>
        </div>
      </div>
    `).join('');
  } else {
    assignSection.classList.add('hidden');
  }

  document.getElementById('editMatchModal').classList.remove('hidden');
  document.getElementById('editMatchModal').classList.add('flex');
};

window.adjStat = function(playerId, stat, delta) {
  const p = appState.players.find(x => x.id === playerId);
  if (p) {
    p[stat] = Math.max(0, (p[stat] || 0) + delta);
    saveState();
    renderScorers();
    renderAssists();
    renderClasses();
    const weekId = document.getElementById('editMatchWeekId').value;
    const matchId = document.getElementById('editMatchId').value;
    if (weekId && matchId) window.openEditMatchModal(weekId, matchId);
  }
};

window.deleteMatch = function(weekId, matchId) {
  if (!confirm('Delete this match?')) return;
  const week = appState.weeks.find(w => w.id === weekId);
  if (week) {
    week.matches = (week.matches || []).filter(m => m.id !== matchId);
    saveState();
    renderLeagueTable();
    renderFixtures();
    updateAdminStats();
    showToast('Match deleted', 'info');
  }
};

window.deleteWeek = function(weekId) {
  if (!confirm('Delete this entire week?')) return;
  appState.weeks = appState.weeks.filter(w => w.id !== weekId);
  saveState();
  renderLeagueTable();
  renderFixtures();
  updateAdminStats();
  showToast('Week deleted', 'info');
};

window.deleteClass = function(classId) {
  if (!confirm('Delete this class team and its players?')) return;
  appState.classes = appState.classes.filter(c => c.id !== classId);
  appState.players = appState.players.filter(p => p.teamId !== classId);
  saveState();
  renderLeagueTable();
  renderClasses();
  renderScorers();
  renderAssists();
  updateAdminStats();
  showToast('Class team deleted', 'info');
};

window.deletePlayer = function(playerId) {
  appState.players = appState.players.filter(p => p.id !== playerId);
  saveState();
  renderClasses();
  renderScorers();
  renderAssists();
  showToast('Player removed', 'info');
};

function initApp() {
  loadState();
  updateAuthUI();
  renderLeagueTable();
  renderFixtures();
  renderClasses();
  renderScorers();
  renderAssists();
  updateAdminStats();

  ['league', 'fixtures', 'classes', 'scorers', 'assists', 'admin'].forEach(t => {
    document.getElementById(`tabBtn-${t}`)?.addEventListener('click', () => switchTab(t));
  });

  document.getElementById('btnAuthAction')?.addEventListener('click', () => {
    if (appState.isAdmin) {
      logoutAdmin();
    } else {
      document.getElementById('loginModal').classList.remove('hidden');
      document.getElementById('loginModal').classList.add('flex');
    }
  });

  document.getElementById('btnAuthActionMob')?.addEventListener('click', () => {
    if (appState.isAdmin) {
      logoutAdmin();
    } else {
      document.getElementById('loginModal').classList.remove('hidden');
      document.getElementById('loginModal').classList.add('flex');
    }
  });

  document.getElementById('btnCloseLoginModal')?.addEventListener('click', () => {
    document.getElementById('loginModal').classList.add('hidden');
  });

  document.getElementById('formModalLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('modalLoginUsername').value;
    const p = document.getElementById('modalLoginPassword').value;
    if (await loginAdmin(u, p)) {
      document.getElementById('loginModal').classList.add('hidden');
    }
  });

  document.getElementById('formInlineLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('inlineLoginUsername').value;
    const p = document.getElementById('inlineLoginPassword').value;
    await loginAdmin(u, p);
  });

  document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
    logoutAdmin();
  });

  document.getElementById('btnOpenAddWeekModal')?.addEventListener('click', () => {
    document.getElementById('addWeekModal').classList.remove('hidden');
    document.getElementById('addWeekModal').classList.add('flex');
  });
  document.getElementById('btnCloseAddWeekModal')?.addEventListener('click', () => {
    document.getElementById('addWeekModal').classList.add('hidden');
  });
  document.getElementById('formAddWeek')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('weekTitleInput').value.trim();
    if (title) {
      appState.weeks.push({ id: 'w_' + Date.now(), title, matches: [] });
      saveState();
      renderFixtures();
      updateAdminStats();
      document.getElementById('addWeekModal').classList.add('hidden');
      document.getElementById('weekTitleInput').value = '';
      showToast('Week added', 'success');
    }
  });

  document.getElementById('btnOpenAddClassModal')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.remove('hidden');
    document.getElementById('addClassModal').classList.add('flex');
  });
  document.getElementById('btnAdminAddClass')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.remove('hidden');
    document.getElementById('addClassModal').classList.add('flex');
  });
  document.getElementById('btnCloseAddClassModal')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.add('hidden');
  });
  document.getElementById('formAddClass')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('classNameInput').value.trim();
    const color = document.getElementById('classColorInput').value;
    if (name) {
      appState.classes.push({ id: 'c_' + Date.now(), name, color });
      saveState();
      renderLeagueTable();
      renderClasses();
      updateAdminStats();
      document.getElementById('addClassModal').classList.add('hidden');
      document.getElementById('classNameInput').value = '';
      showToast('Class team created', 'success');
    }
  });

  document.getElementById('btnCloseAddMatchModal')?.addEventListener('click', () => {
    document.getElementById('addMatchModal').classList.add('hidden');
  });
  document.getElementById('formAddMatch')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const weekId = document.getElementById('matchWeekId').value;
    const homeTeamId = document.getElementById('matchHomeTeam').value;
    const awayTeamId = document.getElementById('matchAwayTeam').value;
    const hs = document.getElementById('matchHomeScore').value;
    const as = document.getElementById('matchAwayScore').value;

    if (homeTeamId === awayTeamId) {
      showToast('Home and Away teams must be different!', 'error');
      return;
    }

    const week = appState.weeks.find(w => w.id === weekId);
    if (week) {
      week.matches = week.matches || [];
      week.matches.push({
        id: 'm_' + Date.now(),
        homeTeamId,
        awayTeamId,
        homeScore: hs !== '' ? parseInt(hs, 10) : null,
        awayScore: as !== '' ? parseInt(as, 10) : null
      });
      saveState();
      renderLeagueTable();
      renderFixtures();
      updateAdminStats();
      document.getElementById('addMatchModal').classList.add('hidden');
      showToast('Match scheduled', 'success');
    }
  });

  document.getElementById('btnCloseEditMatchModal')?.addEventListener('click', () => {
    document.getElementById('editMatchModal').classList.add('hidden');
  });
  document.getElementById('formEditMatch')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const weekId = document.getElementById('editMatchWeekId').value;
    const matchId = document.getElementById('editMatchId').value;
    const hs = document.getElementById('modalHomeScore').value;
    const as = document.getElementById('modalAwayScore').value;

    const week = appState.weeks.find(w => w.id === weekId);
    if (week) {
      const match = (week.matches || []).find(m => m.id === matchId);
      if (match) {
        match.homeScore = parseInt(hs, 10);
        match.awayScore = parseInt(as, 10);
        saveState();
        renderLeagueTable();
        renderFixtures();
        document.getElementById('editMatchModal').classList.add('hidden');
        showToast('Match score saved', 'success');
      }
    }
  });

  document.getElementById('btnCloseAddPlayerModal')?.addEventListener('click', () => {
    document.getElementById('addPlayerModal').classList.add('hidden');
  });
  document.getElementById('formAddPlayer')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const teamId = document.getElementById('playerTeamId').value;
    const name = document.getElementById('playerNameInput').value.trim();
    const number = parseInt(document.getElementById('playerNumberInput').value, 10) || 10;

    if (name && teamId) {
      appState.players.push({
        id: 'p_' + Date.now(),
        teamId,
        name,
        number,
        goals: 0,
        assists: 0
      });
      saveState();
      renderClasses();
      document.getElementById('addPlayerModal').classList.add('hidden');
      document.getElementById('playerNameInput').value = '';
      showToast('Player added', 'success');
    }
  });

  document.getElementById('btnClearFixtures')?.addEventListener('click', () => {
    if (confirm('Clear all scheduled weeks and matches?')) {
      appState.weeks = [];
      saveState();
      renderLeagueTable();
      renderFixtures();
      updateAdminStats();
      showToast('Fixtures cleared', 'info');
    }
  });

  document.getElementById('btnAdminSaveCloud')?.addEventListener('click', async () => {
    await saveState();
    showToast('All changes saved to cloud!', 'success');
  });

  document.getElementById('btnAdminResetAll')?.addEventListener('click', () => {
    if (confirm('RESET ALL DATA? This cannot be undone.')) {
      appState.weeks = [];
      appState.players = [];
      appState.classes = [
        { id: 'c9a', name: '9A Class', color: '#00b5e2' },
        { id: 'c9b', name: '9B Class', color: '#3b82f6' },
        { id: 'c10a', name: '10A Class', color: '#10b981' },
        { id: 'c10b', name: '10B Class', color: '#f59e0b' }
      ];
      saveState();
      renderLeagueTable();
      renderFixtures();
      renderClasses();
      renderScorers();
      renderAssists();
      updateAdminStats();
      showToast('Tournament data reset', 'info');
    }
  });

  document.getElementById('btnExportHtml')?.addEventListener('click', () => {
    const blob = new Blob([document.documentElement.outerHTML], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "index.html";
    a.click();
    showToast('Downloaded updated index.html!', 'success');
  });

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light');
    appState.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };
  document.getElementById('btnToggleTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnToggleThemeMob')?.addEventListener('click', toggleTheme);

  document.getElementById('classSearchInput')?.addEventListener('input', renderClasses);

  document.getElementById('btnRefreshLeague')?.addEventListener('click', () => {
    renderLeagueTable();
    showToast('Standings refreshed', 'info');
  });
}

document.getElementById('btnEnterPortal')?.addEventListener('click', enterPortal);
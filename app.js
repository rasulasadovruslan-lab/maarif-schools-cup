/* Maarif Schools Cup – app.js
   Works out of the box in LOCAL mode (data saved in this browser).
   To enable shared cloud sync, paste your Firebase web config below. */

const FIREBASE_CONFIG = null; // e.g. { apiKey:"...", authDomain:"...", projectId:"...", appId:"..." }
const APP_ID = ""; // <-- the {appId} in artifacts/{appId}/public_data/tournament_state (see Firestore Data tab)
const ADMIN_EMAIL = "rasulasadovruslan@gmail.com"; // the only account your Firestore rules allow to write
const ADMIN_ALIAS = "admin_sarxan"; // typing this username signs in as ADMIN_EMAIL (or just type the full email)

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const LS = "maarif_state_v1";

let state = { classes: [], weeks: [], news: [] };
let isAdmin = false,
  cloud = null,
  cloudBlocked = false,
  confirmRes = null,
  classFilter = "";

const normalize = (s) => ({
  classes: (s?.classes || []).map((c) => ({ ...c, players: c.players || [] })),
  weeks: (s?.weeks || []).map((w) => ({ ...w, matches: w.matches || [] })),
  news: s?.news || [],
});
try {
  state = normalize(JSON.parse(localStorage.getItem(LS)));
} catch {
  state = normalize(null);
}

/* ---------- helpers ---------- */
function toast(msg, type = "success") {
  const d = document.createElement("div");
  d.className = `pointer-events-auto glass-panel px-4 py-3 rounded-2xl text-sm font-semibold border ${type === "error" ? "border-red-500/40 text-red-500" : "border-maarifAccent/40 text-maarifAccent"}`;
  d.textContent = msg;
  $("toastContainer").appendChild(d);
  setTimeout(() => d.remove(), 3200);
}
const openM = (id) => {
  $(id).classList.remove("hidden");
  $(id).classList.add("flex");
};
const closeM = (id) => {
  $(id).classList.add("hidden");
  $(id).classList.remove("flex");
  if (id === "customConfirmModal" && confirmRes) {
    confirmRes(false);
    confirmRes = null;
  }
};
function confirmBox(msg) {
  $("customConfirmMessage").textContent = msg;
  openM("customConfirmModal");
  return new Promise((r) => (confirmRes = r));
}
const cls = (id) => state.classes.find((c) => c.id === id);
const badge = (c) =>
  c
    ? `<span class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-black text-black shrink-0" style="background:${esc(c.color || "#a3e635")}">${esc(c.name.slice(0, 3).toUpperCase())}</span>`
    : "";
const empty = (t, cols = 1) =>
  `<div class="p-8 text-center text-sm text-gray-500 font-medium">${t}</div>`;
const emptyRow = (t, cols) =>
  `<tr><td colspan="${cols}" class="p-8 text-center text-sm text-gray-500 font-medium">${t}</td></tr>`;
const adminOnly = (html) => (isAdmin ? html : "");

function persist() {
  try {
    localStorage.setItem(LS, JSON.stringify(state));
  } catch {}
  if (cloud && isAdmin && !cloudBlocked) {
    cloud.setDoc(cloud.ref, JSON.parse(JSON.stringify(state))).catch((e) => {
      console.error(e);
      toast("Cloud save failed (check Firestore rules)", "error");
    });
  }
}
function commit(msg) {
  persist();
  renderAll();
  if (msg) toast(msg);
}

/* ---------- computed data ---------- */
function leagueRows() {
  const t = {};
  state.classes.forEach(
    (c) => (t[c.id] = { c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }),
  );
  state.weeks.forEach((w) =>
    w.matches.forEach((m) => {
      if (!m.played || !t[m.home] || !t[m.away]) return;
      const h = t[m.home],
        a = t[m.away];
      h.p++;
      a.p++;
      h.gf += m.hs;
      h.ga += m.as;
      a.gf += m.as;
      a.ga += m.hs;
      if (m.hs > m.as) {
        h.w++;
        a.l++;
      } else if (m.hs < m.as) {
        a.w++;
        h.l++;
      } else {
        h.d++;
        a.d++;
      }
    }),
  );
  return Object.values(t)
    .map((r) => ({ ...r, gd: r.gf - r.ga, pts: r.w * 3 + r.d }))
    .sort(
      (x, y) =>
        y.pts - x.pts ||
        y.gd - x.gd ||
        y.gf - x.gf ||
        x.c.name.localeCompare(y.c.name),
    );
}
function playerStats() {
  const s = {};
  state.classes.forEach((c) =>
    c.players.forEach((p) => (s[p.id] = { p, c, g: 0, a: 0 })),
  );
  state.weeks.forEach((w) =>
    w.matches.forEach((m) => {
      if (!m.played) return;
      for (const [id, v] of Object.entries(m.stats || {}))
        if (s[id]) {
          s[id].g += v.g || 0;
          s[id].a += v.a || 0;
        }
    }),
  );
  return Object.values(s);
}

/* ---------- renderers ---------- */
function renderLeague() {
  const rows = leagueRows();
  $("leagueTableBody").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `
    <tr class="hover:bg-black/5 dark:hover:bg-white/5">
      <td class="py-3 px-2 sm:px-4 text-center font-bold ${i === 0 ? "text-maarifAccent" : "text-gray-500"}">${i + 1}</td>
      <td class="py-3 px-2 sm:px-4"><div class="flex items-center gap-3">${badge(r.c)}<span class="font-bold">${esc(r.c.name)}</span></div></td>
      <td class="py-3 px-1 sm:px-3 text-center">${r.p}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.w}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.d}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.l}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.gf}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.ga}</td>
      <td class="py-3 px-1 sm:px-3 text-center hidden sm:table-cell">${r.gd > 0 ? "+" : ""}${r.gd}</td>
      <td class="py-3 px-2 sm:px-4 text-center font-black text-maarifAccent">${r.pts}</td>
    </tr>`,
        )
        .join("")
    : emptyRow("No teams yet. Log in as admin and add a class team.", 10);
}

const CAT = {
  news: "News",
  match: "Match Report",
  injury: "Injury Update",
  announcement: "Announcement",
};
function renderNews() {
  const list = [...state.news].sort(
    (a, b) => b.pinned - a.pinned || b.ts - a.ts,
  );
  $("newsListContainer").innerHTML = list.length
    ? list
        .map(
          (n) => `
    <article class="card-bg p-5 sm:p-6 rounded-3xl space-y-3">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 text-[11px] font-bold">
          ${n.pinned ? '<span class="text-maarifAccent"><i class="fa-solid fa-thumbtack"></i></span>' : ""}
          <span class="px-2 py-0.5 rounded-full ${n.category === "injury" ? "bg-red-500/10 text-red-500" : "bg-maarifAccent/10 text-maarifAccent"}">${CAT[n.category] || "News"}</span>
          <span class="text-gray-500">${new Date(n.ts).toLocaleDateString()}</span>
        </div>
        ${adminOnly(`<div class="flex gap-2 text-xs">
          <button data-a="pin-news" data-n="${n.id}" class="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10">${n.pinned ? "Unpin" : "Pin"}</button>
          <button data-a="edit-news" data-n="${n.id}" class="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10">Edit</button>
          <button data-a="del-news" data-n="${n.id}" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500">Delete</button></div>`)}
      </div>
      <h3 class="text-lg font-bold">${esc(n.title)}</h3>
      <p class="text-sm text-gray-500 whitespace-pre-line">${esc(n.body)}</p>
    </article>`,
        )
        .join("")
    : empty("No news yet.");
  const inj = list.filter((n) => n.category === "injury");
  $("injuryCount").textContent = inj.length;
  $("injuryReportList").innerHTML = inj.length
    ? inj
        .map(
          (n) => `
    <div class="p-3 rounded-xl bg-red-500/5 border border-red-500/10"><div class="text-sm font-bold">${esc(n.title)}</div>
    <div class="text-xs text-gray-500 mt-1">${esc(n.body.slice(0, 100))}${n.body.length > 100 ? "…" : ""}</div></div>`,
        )
        .join("")
    : '<p class="text-xs text-gray-500">No injuries reported.</p>';
}

function renderFixtures() {
  $("fixturesListContainer").innerHTML = state.weeks.length
    ? state.weeks
        .map(
          (w) => `
    <div class="glass-panel rounded-3xl overflow-hidden">
      <div class="flex items-center justify-between gap-3 px-5 py-4 bg-black/5 dark:bg-white/5">
        <h3 class="font-bold">${esc(w.title)}</h3>
        ${adminOnly(`<div class="flex gap-2 text-xs">
          <button data-a="add-match" data-w="${w.id}" class="px-3 py-1.5 rounded-lg bg-maarifAccent text-black font-bold"><i class="fa-solid fa-plus"></i> Match</button>
          <button data-a="del-week" data-w="${w.id}" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500"><i class="fa-solid fa-trash-can"></i></button></div>`)}
      </div>
      <div class="divide-y divide-black/5 dark:divide-white/5">
        ${
          w.matches.length
            ? w.matches
                .map((m) => {
                  const h = cls(m.home),
                    a = cls(m.away);
                  return `<div class="flex items-center gap-2 sm:gap-4 px-4 py-3 text-sm">
            <div class="flex-1 flex items-center justify-end gap-2 font-semibold text-right min-w-0"><span class="truncate">${esc(h?.name || "?")}</span>${badge(h)}</div>
            <div class="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-black min-w-[4.5rem] text-center">${m.played ? `${m.hs} - ${m.as}` : "vs"}</div>
            <div class="flex-1 flex items-center gap-2 font-semibold min-w-0">${badge(a)}<span class="truncate">${esc(a?.name || "?")}</span></div>
            ${adminOnly(`<div class="flex gap-1.5 text-xs">
              <button data-a="edit-match" data-w="${w.id}" data-m="${m.id}" class="px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10"><i class="fa-solid fa-pen-to-square"></i></button>
              <button data-a="del-match" data-w="${w.id}" data-m="${m.id}" class="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500"><i class="fa-solid fa-xmark"></i></button></div>`)}
          </div>`;
                })
                .join("")
            : empty("No matches in this week yet.")
        }
      </div>
    </div>`,
        )
        .join("")
    : empty("No fixtures yet.");
}

function renderClasses() {
  const q = classFilter.trim().toLowerCase();
  const list = state.classes.filter((c) => c.name.toLowerCase().includes(q));
  $("classesGrid").innerHTML = list.length
    ? list
        .map(
          (c) => `
    <div class="glass-panel p-5 rounded-3xl space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">${badge(c)}<div class="min-w-0"><h3 class="font-bold truncate">${esc(c.name)}</h3><p class="text-xs text-gray-500">${c.players.length} players</p></div></div>
        ${adminOnly(`<div class="flex gap-2 text-xs">
          <button data-a="add-player" data-c="${c.id}" class="px-3 py-1.5 rounded-lg bg-maarifAccent text-black font-bold"><i class="fa-solid fa-user-plus"></i></button>
          <button data-a="del-class" data-c="${c.id}" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500"><i class="fa-solid fa-trash-can"></i></button></div>`)}
      </div>
      <div class="space-y-1.5">
        ${
          [...c.players]
            .sort((a, b) => a.number - b.number)
            .map(
              (p) => `
          <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-sm">
            <span class="flex items-center gap-3 min-w-0"><span class="w-7 text-center font-black text-maarifAccent">${p.number}</span><span class="truncate">${esc(p.name)}</span></span>
            ${adminOnly(`<button data-a="del-player" data-c="${c.id}" data-p="${p.id}" class="text-red-500 px-2" title="Remove"><i class="fa-solid fa-xmark"></i></button>`)}
          </div>`,
            )
            .join("") || '<p class="text-xs text-gray-500">No players yet.</p>'
        }
      </div>
    </div>`,
        )
        .join("")
    : `<div class="md:col-span-2">${empty(q ? "No class matches your search." : "No classes yet.")}</div>`;
}

function renderLeaders() {
  const all = playerStats();
  const row = (
    s,
    i,
    main,
    other,
  ) => `<tr class="hover:bg-black/5 dark:hover:bg-white/5">
    <td class="py-3 px-4 text-center font-bold ${i === 0 ? "text-maarifAccent" : "text-gray-500"}">${i + 1}</td>
    <td class="py-3 px-4 font-semibold">${esc(s.p.name)}</td>
    <td class="py-3 px-4 hidden sm:table-cell text-gray-500">${esc(s.c.name)}</td>
    <td class="py-3 px-4 text-center font-black text-maarifAccent">${main}</td>
    <td class="py-3 px-4 text-center">${other}</td></tr>`;
  const sc = all.filter((s) => s.g > 0).sort((a, b) => b.g - a.g || b.a - a.a);
  const as = all.filter((s) => s.a > 0).sort((a, b) => b.a - a.a || b.g - a.g);
  $("scorersTableBody").innerHTML = sc.length
    ? sc.map((s, i) => row(s, i, s.g, s.a)).join("")
    : emptyRow("No goals recorded yet.", 5);
  $("assistsTableBody").innerHTML = as.length
    ? as.map((s, i) => row(s, i, s.a, s.g)).join("")
    : emptyRow("No assists recorded yet.", 5);
}

function renderAdmin() {
  $("adminClassCount").textContent = state.classes.length;
  $("adminMatchCount").textContent = state.weeks.reduce(
    (n, w) => n + w.matches.length,
    0,
  );
}
function renderAll() {
  renderLeague();
  renderNews();
  renderFixtures();
  renderClasses();
  renderLeaders();
  renderAdmin();
}

/* ---------- tabs / theme / admin state ---------- */
const TABS = [
  "league",
  "news",
  "fixtures",
  "classes",
  "scorers",
  "assists",
  "admin",
];
const DESK_ON = [
  "bg-maarifAccent",
  "text-black",
  "shadow-lg",
  "shadow-maarifAccent/20",
];
function showTab(name) {
  TABS.forEach((t) => {
    $("tab-" + t).classList.toggle("hidden", t !== name);
    const d = $("tabBtn-" + t),
      m = $("mobTabBtn-" + t),
      on = t === name;
    DESK_ON.forEach((c) => d.classList.toggle(c, on));
    d.classList.toggle("text-gray-500", !on);
    m.classList.toggle("text-maarifAccent", on);
    m.classList.toggle("text-gray-500", !on);
  });
  window.scrollTo({ top: 0 });
}
function setTheme(t) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(t);
  try {
    localStorage.setItem("maarif_theme", t);
  } catch {}
}
function setAdmin(v) {
  isAdmin = v;
  ["newsAdminControls", "fixtureAdminControls", "classAdminControls"].forEach(
    (id) => $(id).classList.toggle("hidden", !v),
  );
  $("adminLoginPrompt").classList.toggle("hidden", v);
  $("adminDashboardContent").classList.toggle("hidden", !v);
  $("authStatusText").textContent = v ? "Admin" : "Guest";
  $("authDot").className =
    "w-2 h-2 rounded-full " + (v ? "bg-maarifAccent" : "bg-gray-400");
  $("btnAuthAction").textContent = v ? "Logout" : "Admin Login";
  renderAll();
}
async function login(user, pass) {
  if (!cloud) {
    toast("Cloud not configured yet (FIREBASE_CONFIG / APP_ID)", "error");
    return false;
  }
  user = user.trim();
  const email = user.includes("@")
    ? user
    : user.toLowerCase() === ADMIN_ALIAS
      ? ADMIN_EMAIL
      : user;
  try {
    const r = await cloud.signIn(cloud.auth, email, pass);
    if (r.user.email !== ADMIN_EMAIL) {
      await cloud.signOut(cloud.auth);
      toast("This account is not the admin", "error");
      return false;
    }
    closeM("loginModal");
    toast("Signed in as admin");
    showTab("admin");
    return true;
  } catch (e) {
    console.error(e);
    toast("Wrong username or password", "error");
    return false;
  }
}
async function logout() {
  if (cloud) await cloud.signOut(cloud.auth);
  setAdmin(false);
  toast("Logged out");
}

/* ---------- cloud (optional) ---------- */
async function initCloud() {
  if (!FIREBASE_CONFIG || !APP_ID)
    return console.warn(
      "Set FIREBASE_CONFIG and APP_ID in app.js to enable cloud",
    );
  try {
    const b = "https://www.gstatic.com/firebasejs/10.12.2/";
    const [A, Au, F] = await Promise.all([
      import(b + "firebase-app.js"),
      import(b + "firebase-auth.js"),
      import(b + "firebase-firestore.js"),
    ]);
    const app = A.initializeApp(FIREBASE_CONFIG),
      auth = Au.getAuth(app),
      ref = F.doc(
        F.getFirestore(app),
        "artifacts",
        APP_ID,
        "public_data",
        "tournament_state",
      );
    cloud = {
      auth,
      ref,
      setDoc: F.setDoc,
      signIn: Au.signInWithEmailAndPassword,
      signOut: Au.signOut,
    };
    F.onSnapshot(
      ref,
      (s) => {
        if (!s.exists()) {
          if (isAdmin) persist();
          return;
        }
        const d = s.data();
        if (!Array.isArray(d.classes)) {
          // unknown old format: never overwrite it
          cloudBlocked = true;
          console.warn("Firestore doc has a different shape:", d);
          toast(
            "Old data format detected – saving to cloud is paused",
            "error",
          );
          return;
        }
        cloudBlocked = false;
        state = normalize(d);
        renderAll();
      },
      () => toast("Cloud read blocked (check Firestore rules)", "error"),
    );
    Au.onAuthStateChanged(auth, (u) => {
      if (u && u.email === ADMIN_EMAIL) setAdmin(true);
      else {
        setAdmin(false);
        if (u) Au.signOut(auth);
      } // anyone else stays a guest
    });
  } catch (e) {
    console.error(e);
    toast("Cloud unavailable – using local data", "error");
  }
}

/* ---------- splash ---------- */
function buildSplash() {
  const cx = 250,
    cy = 230,
    n = 8,
    pt = (r, a) =>
      `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  let segs = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI + 0.06,
      a1 = ((i + 1) / n) * 2 * Math.PI - 0.06;
    segs += `<path class="seg" style="animation-delay:${i * 0.08}s" fill="${i % 2 ? "#a3e635" : "#fff"}" d="M${pt(95, a0)} L${pt(125, a0)} A125,125 0 0 1 ${pt(125, a1)} L${pt(95, a1)} A95,95 0 0 0 ${pt(95, a0)}Z"/>`;
  }
  $("segs").innerHTML = segs;
  const star = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 26 : 62,
      a = -Math.PI / 2 + (i * Math.PI) / 5;
    star.push(pt(r, a));
  }
  $("starp").setAttribute("points", star.join(" "));
  const bc = $("bubbles-container");
  for (let i = 0; i < 14; i++) {
    const b = document.createElement("div"),
      s = 12 + Math.random() * 40;
    b.className = "bubble";
    b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${10 + Math.random() * 14}s;animation-delay:${Math.random() * 10}s`;
    bc.appendChild(b);
  }
}

/* ---------- modal builders ---------- */
function openAddMatch(weekId) {
  if (state.classes.length < 2)
    return toast("Add at least 2 class teams first", "error");
  const opts = state.classes
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join("");
  $("matchHomeTeam").innerHTML = opts;
  $("matchAwayTeam").innerHTML = opts;
  $("matchAwayTeam").selectedIndex = 1;
  $("matchWeekId").value = weekId;
  $("matchHomeScore").value = "";
  $("matchAwayScore").value = "";
  openM("addMatchModal");
}
function openEditMatch(wId, mId) {
  const m = state.weeks
    .find((w) => w.id === wId)
    ?.matches.find((x) => x.id === mId);
  if (!m) return;
  $("editMatchWeekId").value = wId;
  $("editMatchId").value = mId;
  $("modalHomeName").textContent = cls(m.home)?.name || "Home";
  $("modalAwayName").textContent = cls(m.away)?.name || "Away";
  $("modalHomeScore").value = m.played ? m.hs : "";
  $("modalAwayScore").value = m.played ? m.as : "";
  const teams = [cls(m.home), cls(m.away)].filter((c) => c && c.players.length);
  $("scorersAssignSection").classList.toggle("hidden", !teams.length);
  $("scorersAssignList").innerHTML = teams
    .map(
      (c) => `
    <div class="text-[11px] font-bold text-gray-500 uppercase mt-2">${esc(c.name)} <span class="font-normal">(goals / assists)</span></div>
    ${c.players
      .map((p) => {
        const s = (m.stats || {})[p.id] || {};
        return `
      <div class="flex items-center gap-2 text-sm"><span class="flex-1 truncate">${p.number}. ${esc(p.name)}</span>
        <input type="number" min="0" max="30" data-pg="${p.id}" value="${s.g || 0}" class="w-14 text-center py-1.5 rounded-lg bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
        <input type="number" min="0" max="30" data-pa="${p.id}" value="${s.a || 0}" class="w-14 text-center py-1.5 rounded-lg bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10"></div>`;
      })
      .join("")}`,
    )
    .join("");
  openM("editMatchModal");
}
function openNews(id) {
  const n = state.news.find((x) => x.id === id);
  $("newsModalTitle").textContent = n ? "Edit News" : "Post News";
  $("newsIdInput").value = n?.id || "";
  $("newsTitleInput").value = n?.title || "";
  $("newsCategoryInput").value = n?.category || "news";
  $("newsBodyInput").value = n?.body || "";
  $("newsPinInput").checked = !!n?.pinned;
  openM("newsModal");
}

/* ---------- events ---------- */
function bind() {
  TABS.forEach((t) => {
    $("tabBtn-" + t).onclick = () => showTab(t);
    $("mobTabBtn-" + t).onclick = () => showTab(t);
  });
  $("btnToggleTheme").onclick = () =>
    setTheme(
      document.documentElement.classList.contains("dark") ? "light" : "dark",
    );
  $("btnEnterPortal").onclick = () => {
    $("splashScreen").classList.add("opacity-0", "pointer-events-none");
    $("mainApp").classList.remove("hidden");
    $("mainApp").classList.add("flex");
    setTimeout(() => $("splashScreen").classList.add("hidden"), 700);
  };
  $("btnRefreshLeague").onclick = () => {
    renderAll();
    toast("Table refreshed");
  };

  // auth
  $("btnAuthAction").onclick = () => (isAdmin ? logout() : openM("loginModal"));
  $("btnAuthActionMob").onclick = () => showTab("admin");
  $("btnCloseLoginModal").onclick = () => closeM("loginModal");
  $("formInlineLogin").onsubmit = (e) => {
    e.preventDefault();
    login($("inlineLoginUsername").value, $("inlineLoginPassword").value).then(
      (ok) => ok && e.target.reset(),
    );
  };
  $("formModalLogin").onsubmit = (e) => {
    e.preventDefault();
    login($("modalLoginUsername").value, $("modalLoginPassword").value).then(
      (ok) => ok && e.target.reset(),
    );
  };
  $("btnAdminLogout").onclick = logout;

  // confirm
  $("btnConfirmOk").onclick = () => {
    const r = confirmRes;
    confirmRes = null;
    closeM("customConfirmModal");
    r && r(true);
  };
  $("btnConfirmCancel").onclick = () => closeM("customConfirmModal");

  // open/close modals
  const openAddClass = () => {
    $("formAddClass").reset();
    $("classColorInput").value = "#a3e635";
    openM("addClassModal");
  };
  $("btnOpenAddClassModal").onclick = openAddClass;
  $("btnAdminAddClass").onclick = openAddClass;
  $("btnOpenAddWeekModal").onclick = () => {
    $("formAddWeek").reset();
    openM("addWeekModal");
  };
  $("btnOpenNewsModal").onclick = () => openNews("");
  [
    ["btnCloseAddClassModal", "addClassModal"],
    ["btnCloseAddPlayerModal", "addPlayerModal"],
    ["btnCloseAddMatchModal", "addMatchModal"],
    ["btnCloseAddWeekModal", "addWeekModal"],
    ["btnCloseEditMatchModal", "editMatchModal"],
    ["btnCloseNewsModal", "newsModal"],
  ].forEach(([b, m]) => ($(b).onclick = () => closeM(m)));
  document.querySelectorAll('div[id$="Modal"]').forEach((m) =>
    m.addEventListener("mousedown", (e) => {
      if (e.target === m) closeM(m.id);
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll('div[id$="Modal"]:not(.hidden)')
        .forEach((m) => closeM(m.id));
  });

  $("classSearchInput").oninput = (e) => {
    classFilter = e.target.value;
    renderClasses();
  };

  // forms
  $("formAddClass").onsubmit = (e) => {
    e.preventDefault();
    const name = $("classNameInput").value.trim();
    if (state.classes.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return toast("That class already exists", "error");
    state.classes.push({
      id: uid(),
      name,
      color: $("classColorInput").value,
      players: [],
    });
    closeM("addClassModal");
    commit("Class added");
  };
  $("formAddPlayer").onsubmit = (e) => {
    e.preventDefault();
    const c = cls($("playerTeamId").value),
      num = parseInt($("playerNumberInput").value, 10);
    if (!c) return;
    if (c.players.some((p) => p.number === num))
      return toast(`#${num} is already taken in ${c.name}`, "error");
    c.players.push({
      id: uid(),
      name: $("playerNameInput").value.trim(),
      number: num,
    });
    closeM("addPlayerModal");
    commit("Player added");
  };
  $("formAddWeek").onsubmit = (e) => {
    e.preventDefault();
    state.weeks.push({
      id: uid(),
      title: $("weekTitleInput").value.trim(),
      matches: [],
    });
    closeM("addWeekModal");
    commit("Week created");
  };
  $("formAddMatch").onsubmit = (e) => {
    e.preventDefault();
    const w = state.weeks.find((x) => x.id === $("matchWeekId").value);
    const home = $("matchHomeTeam").value,
      away = $("matchAwayTeam").value;
    if (!w) return;
    if (home === away) return toast("Pick two different teams", "error");
    const hs = $("matchHomeScore").value,
      as = $("matchAwayScore").value,
      played = hs !== "" && as !== "";
    w.matches.push({
      id: uid(),
      home,
      away,
      hs: played ? +hs : 0,
      as: played ? +as : 0,
      played,
      stats: {},
    });
    closeM("addMatchModal");
    commit("Fixture saved");
  };
  $("formEditMatch").onsubmit = (e) => {
    e.preventDefault();
    const m = state.weeks
      .find((w) => w.id === $("editMatchWeekId").value)
      ?.matches.find((x) => x.id === $("editMatchId").value);
    if (!m) return;
    const hs = +$("modalHomeScore").value,
      as = +$("modalAwayScore").value,
      stats = {},
      sum = { [m.home]: 0, [m.away]: 0 };
    const owner = (pid) =>
      [m.home, m.away].find((id) => cls(id)?.players.some((p) => p.id === pid));
    document.querySelectorAll("#scorersAssignList [data-pg]").forEach((i) => {
      const id = i.dataset.pg,
        g = Math.max(0, +i.value || 0),
        a = Math.max(
          0,
          +document.querySelector(`[data-pa="${id}"]`).value || 0,
        );
      if (g || a) stats[id] = { g, a };
      sum[owner(id)] += g;
    });
    if (sum[m.home] > hs || sum[m.away] > as)
      return toast("Player goals can't exceed the team score", "error");
    Object.assign(m, { hs, as, played: true, stats });
    closeM("editMatchModal");
    commit("Result saved");
  };
  $("formNews").onsubmit = (e) => {
    e.preventDefault();
    const id = $("newsIdInput").value,
      d = {
        title: $("newsTitleInput").value.trim(),
        category: $("newsCategoryInput").value,
        body: $("newsBodyInput").value.trim(),
        pinned: $("newsPinInput").checked,
      };
    const n = state.news.find((x) => x.id === id);
    if (n) Object.assign(n, d);
    else state.news.push({ id: uid(), ts: Date.now(), ...d });
    closeM("newsModal");
    commit("News saved");
  };

  // admin actions
  $("btnAdminSaveCloud").onclick = () => {
    persist();
    toast(cloud ? "Saved to cloud" : "Saved on this device");
  };
  $("btnExportHtml").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    a.download = "maarif-cup-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("btnAdminResetAll").onclick = async () => {
    if (await confirmBox("Delete ALL classes, fixtures and news?")) {
      state = normalize(null);
      commit("All data reset");
    }
  };
  $("btnClearFixtures").onclick = async () => {
    if (await confirmBox("Delete all fixtures and results?")) {
      state.weeks = [];
      commit("Fixtures cleared");
    }
  };

  // delegated buttons inside rendered lists
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b || !isAdmin) return;
    const { a, w, m, c, p, n } = b.dataset;
    const week = state.weeks.find((x) => x.id === w),
      team = cls(c);
    if (a === "add-match") openAddMatch(w);
    else if (a === "edit-match") openEditMatch(w, m);
    else if (a === "del-match") {
      if (await confirmBox("Delete this match?")) {
        week.matches = week.matches.filter((x) => x.id !== m);
        commit("Match deleted");
      }
    } else if (a === "del-week") {
      if (await confirmBox("Delete this week and its matches?")) {
        state.weeks = state.weeks.filter((x) => x.id !== w);
        commit("Week deleted");
      }
    } else if (a === "add-player") {
      $("formAddPlayer").reset();
      $("playerTeamId").value = c;
      $("addPlayerModalTeamName").textContent = team.name;
      $("playerNumberInput").value = 10;
      openM("addPlayerModal");
    } else if (a === "del-player") {
      if (await confirmBox("Remove this player?")) {
        team.players = team.players.filter((x) => x.id !== p);
        commit("Player removed");
      }
    } else if (a === "del-class") {
      if (await confirmBox(`Delete ${team.name} and all its matches?`)) {
        state.classes = state.classes.filter((x) => x.id !== c);
        state.weeks.forEach(
          (x) =>
            (x.matches = x.matches.filter(
              (mm) => mm.home !== c && mm.away !== c,
            )),
        );
        commit("Class deleted");
      }
    } else if (a === "edit-news") openNews(n);
    else if (a === "pin-news") {
      const x = state.news.find((v) => v.id === n);
      x.pinned = !x.pinned;
      commit();
    } else if (a === "del-news") {
      if (await confirmBox("Delete this post?")) {
        state.news = state.news.filter((x) => x.id !== n);
        commit("Post deleted");
      }
    }
  });
}

/* ---------- init ---------- */
try {
  setTheme(localStorage.getItem("maarif_theme") || "dark");
} catch {
  setTheme("dark");
}
buildSplash();
bind();
showTab("league");
setAdmin(false);
initCloud();

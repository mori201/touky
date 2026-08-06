/* ============================================================
   TOUKY — Frontend (JavaScript natif, sans framework)
   Communique avec le backend via l'API REST /api/*
============================================================ */

const el = document.getElementById("app");

const state = {
  role: "voyageur",           // voyageur | gare | admin
  screen: "login",
  regions: [],                // [{id, nom, departements:[{id, nom}]}]
  gares: [],                  // annuaire complet (admin)
  stats: null,
  user: null,
  phone: "",
  search: {
    depRegionId: "", depDeptId: "",
    arrRegionId: "", arrDeptId: "",
    date: new Date().toISOString().slice(0, 10),
    passengers: 1,
  },
  results: null,              // { gareDepart, gareArrivee, trajets }
  selectedTrip: null,
  selectedSeats: [],
  payMethod: null,
  lastBooking: null,
  history: [],
  openRegion: null,
  adminQuery: "",
  gareId: 1,                  // gare sélectionnée dans le tableau de bord "Gare routière"
  gareReservations: [],
};

/* ---------------------- API helper ---------------------- */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur réseau");
  return data;
}

function findRegion(id) { return state.regions.find((r) => r.id === Number(id)); }
function findDept(regionId, deptId) {
  const r = findRegion(regionId);
  return r ? r.departements.find((d) => d.id === Number(deptId)) : null;
}
function fmtDuree(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h${m ? m : "00"}`;
}
function fmtF(n) { return Number(n).toLocaleString("fr-FR") + " F"; }

/* ---------------------- Actions ---------------------- */

async function ensureUser() {
  if (state.user) return state.user;
  const phone = state.phone || "+221770000001";
  const user = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ telephone: phone }) });
  state.user = user;
  return user;
}

async function doSearch() {
  const { depDeptId, arrDeptId, date } = state.search;
  if (!depDeptId || !arrDeptId || !date) return;
  const q = new URLSearchParams({ depart: depDeptId, arrivee: arrDeptId, date });
  state.results = await api(`/api/trajets/search?${q.toString()}`);
  state.screen = "results";
  render();
}

async function selectTrip(id) {
  const t = state.results.trajets.find((x) => String(x.id) === String(id));
  if (!t || t.seatsRemaining <= 0) return;
  const fresh = await api(`/api/trajets/${id}/sieges?date=${state.search.date}`);
  t.seatsTaken = fresh.occupied;
  t.seatsRemaining = t.places_totales - fresh.occupied.length;
  state.selectedTrip = t;
  state.selectedSeats = [];
  state.payMethod = null;
  state.screen = "detail";
  render();
}

function toggleSeat(n) {
  n = Number(n);
  const t = state.selectedTrip;
  if (t.seatsTaken.includes(n)) return;
  const i = state.selectedSeats.indexOf(n);
  if (i >= 0) state.selectedSeats.splice(i, 1);
  else if (state.selectedSeats.length < state.search.passengers) state.selectedSeats.push(n);
  render();
}

async function pay() {
  await ensureUser();
  try {
    const booking = await api("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        utilisateur_id: state.user.id,
        trajet_id: state.selectedTrip.id,
        date_voyage: state.search.date,
        sieges: state.selectedSeats,
        methode_paiement: state.payMethod,
      }),
    });
    state.lastBooking = booking;
    state.screen = "ticket";
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function loadHistory() {
  await ensureUser();
  state.history = await api(`/api/reservations?utilisateur_id=${state.user.id}`);
}

async function loadGareDashboard() {
  state.gareReservations = await api(`/api/gare/${state.gareId}/reservations`);
}

async function setDemandeStatut(id, statut) {
  await api(`/api/reservations/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
  await loadGareDashboard();
  render();
}

/* ---------------------- UI: atoms ---------------------- */

function topbar(title, back, right = "") {
  return `<div class="topbar">
    <div class="left">${back ? `<button class="back" data-action="back">←</button>` : ""}<span class="title">${title}</span></div>
    <div>${right}</div>
  </div>`;
}
function bottomnav(active) {
  const items = [["home", "🏠", "Accueil"], ["history", "🎫", "Réservations"], ["notifications", "🔔", "Notifs"], ["profile", "👤", "Profil"]];
  return `<div class="bottomnav">${items.map(([k, icon, label]) =>
    `<button class="${active === k ? "active" : ""}" data-action="goScreen" data-screen="${k}"><span>${icon}</span><span>${label}</span></button>`
  ).join("")}</div>`;
}
function regionOptions(selected) {
  return `<option value="">Région</option>` + state.regions.map((r) => `<option value="${r.id}" ${String(r.id) === String(selected) ? "selected" : ""}>${r.nom}</option>`).join("");
}
function deptOptions(regionId, selected) {
  const r = findRegion(regionId);
  if (!r) return `<option value="">Département</option>`;
  return `<option value="">Département</option>` + r.departements.map((d) => `<option value="${d.id}" ${String(d.id) === String(selected) ? "selected" : ""}>${d.nom}</option>`).join("");
}

/* ---------------------- Screens: Voyageur ---------------------- */

function screenLogin() {
  return `
  <div style="background:var(--petrol);min-height:640px;display:flex;flex-direction:column;justify-content:center;padding:1.6rem;">
    <div style="text-align:center;margin-bottom:1.6rem;">
      <div class="display" style="font-size:2rem;color:var(--ochre);">TOUKY</div>
      <div class="mono" style="font-size:.7rem;color:var(--sable);">Réserve ton voyage, partout au Sénégal</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:1rem;">
      <div style="font-size:.78rem;font-weight:700;color:var(--petrol);margin-bottom:.5rem;">Connexion par téléphone</div>
      <input class="field" placeholder="+221 77 XXX XX XX" value="${state.phone}" data-bind="phone" />
      <button class="btn" data-action="login">Se connecter</button>
      <button class="btn ghost" style="margin-top:.5rem;" data-action="skipLogin">Continuer sans compte →</button>
    </div>
  </div>`;
}

function screenHome() {
  const totalDept = state.regions.reduce((a, r) => a + r.departements.length, 0);
  return `
  ${topbar("Bonjour 👋", false, "🔔")}
  <div class="content">
    <button class="card row-between" style="width:100%;text-align:left;background:var(--sable-deep);border:none;" data-action="goScreen" data-screen="regions">
      <span class="mono" style="font-size:.66rem;color:var(--petrol);">🗺️ 14 régions · ${totalDept} départements couverts</span>
      <span>›</span>
    </button>

    <select class="field" data-bind="depRegionId">${regionOptions(state.search.depRegionId)}</select>
    ${state.search.depRegionId ? `<select class="field" data-bind="depDeptId">${deptOptions(state.search.depRegionId, state.search.depDeptId)}</select>` : ""}
    <select class="field" data-bind="arrRegionId">${regionOptions(state.search.arrRegionId)}</select>
    ${state.search.arrRegionId ? `<select class="field" data-bind="arrDeptId">${deptOptions(state.search.arrRegionId, state.search.arrDeptId)}</select>` : ""}
    <input type="date" class="field" data-bind="date" value="${state.search.date}" />

    <div class="field row-between">
      <span>${state.search.passengers} place${state.search.passengers > 1 ? "s" : ""}</span>
      <div style="display:flex;gap:.4rem;">
        <button class="btn small" data-action="decPassengers" style="background:var(--sable-deep);color:var(--ink);">−</button>
        <button class="btn small" data-action="incPassengers" style="background:var(--sable-deep);color:var(--ink);">+</button>
      </div>
    </div>

    <button class="btn" data-action="search" ${(!state.search.depDeptId || !state.search.arrDeptId || !state.search.date) ? "disabled" : ""}>🔎 Rechercher un trajet</button>

    <div class="hint" style="margin-top:1rem;">Trajets populaires</div>
    ${[["Dakar", "Thiès", "3 500 F"], ["Dakar", "Ziguinchor", "9 000 F"], ["Kaolack", "Tambacounda", "5 500 F"]].map(([a, b, p]) => `
      <button class="card row-between" style="width:100%;text-align:left;" data-action="prefill" data-dep="${a}" data-arr="${b}">
        <span style="font-size:.72rem;">${a} → ${b}</span><span style="font-size:.72rem;font-weight:700;color:var(--corail);">${p}</span>
      </button>`).join("")}
  </div>
  ${bottomnav("home")}`;
}

function screenRegions() {
  const totalDept = state.regions.reduce((a, r) => a + r.departements.length, 0);
  return `
  ${topbar("Régions & départements", true)}
  <div class="content">
    <div class="hint">TOUKY couvre les 14 régions et les ${totalDept} départements du Sénégal.</div>
    ${state.regions.map((r) => `
      <div class="accordion-item">
        <div class="accordion-head" data-action="toggleRegion" data-region="${r.nom}">
          <span class="name">${r.nom}</span>
          <span class="pill">${r.departements.length} dépt.</span>
        </div>
        ${state.openRegion === r.nom ? `<div class="accordion-body">${r.departements.map((d) => `<span class="chip">${d.nom}</span>`).join("")}</div>` : ""}
      </div>`).join("")}
  </div>`;
}

function screenResults() {
  const { gareDepart, gareArrivee, trajets } = state.results;
  return `
  ${topbar(`${gareDepart.departement} → ${gareArrivee.departement}`, true)}
  <div class="content">
    <div class="card" style="background:var(--sable-deep);display:flex;align-items:center;gap:.4rem;">
      <span style="font-size:.7rem;">📍 Gare de départ : <b>${gareDepart.nom}</b></span>
      ${gareDepart.distance > 0 ? `<span class="pill">${gareDepart.distance} km</span>` : `<span class="pill green">Sur place</span>`}
    </div>
    ${trajets.length === 0 ? `<div class="center-note">Aucun trajet direct trouvé pour cette date.</div>` : ""}
    ${trajets.map((t) => {
      const complet = t.seatsRemaining <= 0;
      return `<button class="card clickable" style="width:100%;text-align:left;" data-action="selectTrip" data-id="${t.id}" ${complet ? "disabled" : ""}>
        <div class="row-between">
          <span style="font-weight:700;color:var(--petrol);">${t.heure_depart}</span>
          <span style="font-weight:700;color:var(--corail);">${fmtF(t.prix)}</span>
        </div>
        <div class="row-between" style="margin-top:.2rem;">
          <span class="muted">${t.transporteur} · ${fmtDuree(t.duree_minutes)}</span>
          <span style="font-size:.68rem;color:${complet ? "var(--corail)" : "var(--green)"};">${complet ? "Complet" : `${t.seatsRemaining} places restantes`}</span>
        </div>
      </button>`;
    }).join("")}
    <button class="btn ghost" data-action="goScreen" data-screen="regions">Changer de gare manuellement</button>
  </div>`;
}

function screenDetail() {
  const t = state.selectedTrip;
  const { gareDepart, gareArrivee } = state.results;
  const seats = Array.from({ length: t.places_totales }, (_, i) => i + 1);
  return `
  ${topbar("Détail du trajet", true)}
  <div class="content">
    <div class="card">
      <div class="row-between"><b style="color:var(--petrol);">${t.transporteur}</b><span class="pill">${t.heure_depart}</span></div>
      <div class="muted" style="margin-top:.3rem;">${gareDepart.departement} (${gareDepart.nom}) → ${gareArrivee.departement}</div>
      <div class="muted">Durée estimée : ${fmtDuree(t.duree_minutes)} · Climatisé</div>
    </div>
    <div style="font-size:.75rem;margin-bottom:.4rem;">Sélectionnez ${state.search.passengers} place${state.search.passengers > 1 ? "s" : ""} (${state.selectedSeats.length}/${state.search.passengers})</div>
    <div class="seat-grid">
      ${seats.map((n) => {
        const taken = t.seatsTaken.includes(n);
        const chosen = state.selectedSeats.includes(n);
        return `<button class="seat ${taken ? "taken" : ""} ${chosen ? "chosen" : ""}" data-action="toggleSeat" data-num="${n}" ${taken ? "disabled" : ""}>${n}</button>`;
      }).join("")}
    </div>
    <button class="btn" data-action="goPayment" ${state.selectedSeats.length !== state.search.passengers ? "disabled" : ""}>
      Continuer — ${fmtF(t.prix * state.search.passengers)}
    </button>
  </div>`;
}

function screenPayment() {
  const t = state.selectedTrip;
  const methods = [["orange", "🟠", "Orange Money"], ["wave", "🔵", "Wave"], ["free", "🟡", "Free Money"], ["carte", "💳", "Carte bancaire"]];
  return `
  ${topbar("Paiement", true)}
  <div class="content">
    <div class="card row-between" style="background:var(--sable-deep);">
      <span style="font-weight:700;">Total à payer</span>
      <span style="font-weight:700;color:var(--corail);">${fmtF(t.prix * state.search.passengers)}</span>
    </div>
    <div class="hint">Choisir un moyen de paiement</div>
    ${methods.map(([key, emoji, label]) => `
      <button class="card row-between" style="width:100%;text-align:left;border:${state.payMethod === key ? "2px solid var(--corail)" : "1px solid var(--sable-deep)"};" data-action="selectMethod" data-method="${key}">
        <span>${emoji} ${label}</span>${state.payMethod === key ? "<span>✓</span>" : ""}
      </button>`).join("")}
    <button class="btn" data-action="pay" ${!state.payMethod ? "disabled" : ""}>💳 Payer ${fmtF(t.prix * state.search.passengers)}</button>
    <div class="center-note" style="margin-top:.5rem;">🔒 Paiement sécurisé — reçu envoyé par SMS</div>
  </div>`;
}

function screenTicket() {
  const b = state.lastBooking;
  return `
  ${topbar("Votre e-ticket", true)}
  <div class="content" style="text-align:center;">
    <span class="pill green">Réservation confirmée</span>
    <div class="qrbox"></div>
    <div style="font-weight:700;color:var(--petrol);">${b.trajet.gare_depart_nom.replace("Gare Routière de ", "")} → ${b.trajet.gare_arrivee_nom.replace("Gare Routière de ", "")}</div>
    <div class="muted" style="margin-bottom:.6rem;">${b.trajet.heure_depart} · ${b.date_voyage} · Sièges ${b.sieges.join(", ")}</div>
    <div class="card" style="text-align:left;font-size:.72rem;">
      <div>Transporteur : <b>${b.trajet.transporteur}</b></div>
      <div>Gare de départ : <b>${b.trajet.gare_depart_nom}</b></div>
      <div>Passagers : <b>${b.nb_places}</b></div>
      <div>Référence : <b class="mono">${b.reference}</b></div>
      <div>Montant payé : <b>${fmtF(b.montant_total)}</b></div>
    </div>
    <button class="btn petrol" style="margin-top:.6rem;" data-action="goScreen" data-screen="home">Retour à l'accueil</button>
  </div>`;
}

function screenHistory() {
  return `
  ${topbar("Mes réservations", true)}
  <div class="content">
    ${state.history.length === 0 ? `<div class="center-note">Aucune réservation pour le moment.</div>` : ""}
    ${state.history.map((b) => `
      <button class="card clickable" style="width:100%;text-align:left;" data-action="viewBooking" data-id="${b.id}">
        <div class="row-between">
          <span style="font-weight:700;color:var(--petrol);">${b.gare_depart_nom.replace("Gare Routière de ", "")} → ${b.gare_arrivee_nom.replace("Gare Routière de ", "")}</span>
          <span class="pill ${b.statut === "confirmee" ? "green" : ""}">${b.statut}</span>
        </div>
        <div class="muted">${b.heure_depart} · ${b.date_voyage} · Réf ${b.reference}</div>
      </button>`).join("")}
  </div>
  ${bottomnav("history")}`;
}

function screenNotifications() {
  const notifs = [
    ["Réservation confirmée", "Votre place est confirmée."],
    ["Rappel de départ", "Départ dans 2h — arrivez 30 min avant."],
    ["Nouveau trajet ajouté", "De nouvelles liaisons régionales sont disponibles."],
  ];
  return `
  ${topbar("Notifications", false)}
  <div class="content">
    ${notifs.map(([t, d]) => `<div class="card"><div style="font-weight:700;color:var(--petrol);font-size:.78rem;">${t}</div><div class="muted">${d}</div></div>`).join("")}
  </div>
  ${bottomnav("notifications")}`;
}

function screenProfile() {
  return `
  ${topbar("Mon profil", false)}
  <div class="content">
    <div style="text-align:center;margin-bottom:.8rem;">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--petrol);margin:0 auto .4rem;"></div>
      <div style="font-weight:700;">${state.user ? state.user.nom : "Voyageur TOUKY"}</div>
      <div class="muted">${state.user ? state.user.telephone : state.phone || "+221 77 XXX XX XX"}</div>
    </div>
    <button class="card row-between" style="width:100%;text-align:left;" data-action="goScreen" data-screen="history"><span>🎫 Historique des réservations</span><span>›</span></button>
    <button class="card row-between" style="width:100%;text-align:left;"><span>💳 Historique des paiements</span><span>›</span></button>
    <button class="card row-between" style="width:100%;text-align:left;"><span>⭐ Mes avis</span><span>›</span></button>
    <button class="card row-between" style="width:100%;text-align:left;"><span>❓ FAQ & Assistance</span><span>›</span></button>
    <button class="card row-between" style="width:100%;text-align:left;"><span>🌐 Langue — Français</span><span>›</span></button>
  </div>
  ${bottomnav("profile")}`;
}

const voyageurScreens = {
  login: screenLogin, home: screenHome, regions: screenRegions, results: screenResults,
  detail: screenDetail, payment: screenPayment, ticket: screenTicket, history: screenHistory,
  notifications: screenNotifications, profile: screenProfile,
};

/* ---------------------- Screens: Gare & Admin ---------------------- */

function screenGare() {
  const gareOptions = state.gares.map((g) => `<option value="${g.id}" ${g.id === state.gareId ? "selected" : ""}>${g.nom}</option>`).join("");
  const en_attente = state.gareReservations.filter((r) => r.statut === "attente").length;
  return `
  <div class="dashboard">
    <div class="dash-side">
      <div class="display" style="font-size:1.05rem;">TOUKY</div>
      <div class="mono" style="font-size:.62rem;margin:.6rem 0 .2rem;">Gare sélectionnée</div>
      <select data-bind="gareId">${gareOptions}</select>
    </div>
    <div class="dash-main">
      <div class="kpis">
        <div class="kpi"><div class="v">${en_attente}</div><div class="l">Demandes en attente</div></div>
        <div class="kpi"><div class="v">${state.gareReservations.length}</div><div class="l">Réservations totales</div></div>
        <div class="kpi"><div class="v">${state.gareReservations.filter((r) => r.statut === "confirmee").length}</div><div class="l">Confirmées</div></div>
        <div class="kpi"><div class="v">${state.gares.length ? "16" : "-"}</div><div class="l">Places / véhicule</div></div>
      </div>
      <table>
        <thead><tr><th>Client</th><th>Trajet</th><th>Places</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${state.gareReservations.length === 0 ? `<tr><td colspan="5" class="center-note">Aucune demande pour cette gare.</td></tr>` : ""}
          ${state.gareReservations.map((r) => `
            <tr>
              <td>${r.client_nom}</td>
              <td>→ ${r.gare_arrivee_nom.replace("Gare Routière de ", "")}, ${r.heure_depart}</td>
              <td>${r.nb_places}</td>
              <td>${r.statut === "attente" ? `<span class="pill">En attente</span>` : r.statut === "confirmee" ? `<span class="pill green">Confirmée</span>` : `<span class="pill corail">Refusée</span>`}</td>
              <td>${r.statut === "attente" ? `
                <button class="btn small petrol" data-action="confirmDemande" data-id="${r.id}">✓</button>
                <button class="btn small" style="background:var(--corail);" data-action="refuseDemande" data-id="${r.id}">✕</button>` : ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function screenAdmin() {
  const q = state.adminQuery.toLowerCase();
  const regions = state.regions.filter((r) => !q || r.nom.toLowerCase().includes(q) || r.departements.some((d) => d.nom.toLowerCase().includes(q)));
  const s = state.stats || {};
  return `
  <div class="dashboard">
    <div class="dash-side">
      <div class="display" style="font-size:1.05rem;">TOUKY</div>
      <div style="margin-top:1rem;opacity:.9;">📊 Statistiques</div>
      <div style="margin-top:.5rem;opacity:.7;">🚏 Gares & transporteurs</div>
      <div style="margin-top:.5rem;opacity:.7;">🎫 Réservations & litiges</div>
    </div>
    <div class="dash-main">
      <div class="kpis">
        <div class="kpi"><div class="v">${s.regions ?? "-"}</div><div class="l">Régions couvertes</div></div>
        <div class="kpi"><div class="v">${s.departements ?? "-"}</div><div class="l">Départements</div></div>
        <div class="kpi"><div class="v">${s.trajets ?? "-"}</div><div class="l">Trajets programmés</div></div>
        <div class="kpi"><div class="v">${s.revenus ? fmtF(s.revenus) : "-"}</div><div class="l">Revenus confirmés</div></div>
      </div>
      <div style="font-weight:700;color:var(--petrol);margin-bottom:.5rem;">🏢 Annuaire des gares — régions & départements</div>
      <input class="search-box" placeholder="Rechercher une région ou un département…" value="${state.adminQuery}" data-bind="adminQuery" />
      <div class="region-grid">
        ${regions.map((r) => `
          <div class="region-card">
            <div class="name">${r.nom} <span class="pill">${r.departements.length}</span></div>
            <div class="depts">${r.departements.map((d) => d.nom).join(" · ")}</div>
          </div>`).join("")}
      </div>
    </div>
  </div>`;
}

/* ---------------------- Root render ---------------------- */

function render() {
  const roleTabs = ["voyageur", "gare", "admin"].map((k) => {
    const labels = { voyageur: "Voyageur", gare: "Gare routière", admin: "Admin" };
    return `<button class="${state.role === k ? "active" : ""}" data-action="setRole" data-role="${k}">${labels[k]}</button>`;
  }).join("");

  let body = "";
  if (state.role === "voyageur") {
    const screenFn = voyageurScreens[state.screen] || screenHome;
    body = `<div class="phone-wrap"><div class="phone">${screenFn()}</div></div>`;
  } else if (state.role === "gare") {
    body = screenGare();
  } else {
    body = screenAdmin();
  }

  el.innerHTML = `
    <div class="topswitch">
      <div class="brand">🚌 TOUKY</div>
      <div class="tabs">${roleTabs}</div>
    </div>
    ${body}
  `;
}

/* ---------------------- Event delegation ---------------------- */

el.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  const d = t.dataset;

  if (action === "setRole") {
    state.role = d.role;
    if (state.role === "gare") await loadGareDashboard();
    if (state.role === "admin" && !state.stats) state.stats = await api("/api/stats");
    render();
  } else if (action === "goScreen") {
    state.screen = d.screen;
    if (d.screen === "history") await loadHistory();
    render();
  } else if (action === "back") {
    const backMap = { regions: "home", results: "home", detail: "results", payment: "detail", ticket: "home", history: "home" };
    state.screen = backMap[state.screen] || "home";
    render();
  } else if (action === "login") {
    await ensureUser();
    state.screen = "home";
    render();
  } else if (action === "skipLogin") {
    state.screen = "home";
    render();
  } else if (action === "toggleRegion") {
    state.openRegion = state.openRegion === d.region ? null : d.region;
    render();
  } else if (action === "prefill") {
    const dep = state.regions.find((r) => r.nom === d.dep);
    const arr = state.regions.find((r) => r.nom === d.arr);
    if (dep) { state.search.depRegionId = dep.id; state.search.depDeptId = dep.departements.find((x) => x.nom === d.dep)?.id || ""; }
    if (arr) { state.search.arrRegionId = arr.id; state.search.arrDeptId = arr.departements.find((x) => x.nom === d.arr)?.id || ""; }
    render();
  } else if (action === "incPassengers") {
    state.search.passengers = Math.min(6, state.search.passengers + 1); render();
  } else if (action === "decPassengers") {
    state.search.passengers = Math.max(1, state.search.passengers - 1); render();
  } else if (action === "search") {
    await doSearch();
  } else if (action === "selectTrip") {
    await selectTrip(d.id);
  } else if (action === "toggleSeat") {
    toggleSeat(d.num);
  } else if (action === "goPayment") {
    state.screen = "payment"; render();
  } else if (action === "selectMethod") {
    state.payMethod = d.method; render();
  } else if (action === "pay") {
    await pay();
  } else if (action === "viewBooking") {
    const b = state.history.find((x) => String(x.id) === String(d.id));
    state.lastBooking = {
      ...b,
      trajet: { transporteur: b.transporteur, heure_depart: b.heure_depart, gare_depart_nom: b.gare_depart_nom, gare_arrivee_nom: b.gare_arrivee_nom },
    };
    state.screen = "ticket"; render();
  } else if (action === "confirmDemande") {
    await setDemandeStatut(d.id, "confirmee");
  } else if (action === "refuseDemande") {
    await setDemandeStatut(d.id, "refusee");
  }
});

el.addEventListener("change", async (e) => {
  const bind = e.target.dataset.bind;
  if (!bind) return;
  if (bind === "depRegionId") { state.search.depRegionId = e.target.value; state.search.depDeptId = ""; render(); }
  else if (bind === "arrRegionId") { state.search.arrRegionId = e.target.value; state.search.arrDeptId = ""; render(); }
  else if (bind === "depDeptId") { state.search.depDeptId = e.target.value; render(); }
  else if (bind === "arrDeptId") { state.search.arrDeptId = e.target.value; render(); }
  else if (bind === "date") { state.search.date = e.target.value; }
  else if (bind === "gareId") { state.gareId = Number(e.target.value); await loadGareDashboard(); render(); }
});

el.addEventListener("input", (e) => {
  const bind = e.target.dataset.bind;
  if (bind === "phone") state.phone = e.target.value;
  if (bind === "adminQuery") { state.adminQuery = e.target.value; render(); }
});

/* ---------------------- Boot ---------------------- */

(async function init() {
  el.innerHTML = `<div class="center-note" style="padding:3rem;">Chargement de TOUKY…</div>`;
  try {
    state.regions = await api("/api/regions");
    state.gares = await api("/api/gares");
    if (state.gares.length) state.gareId = state.gares[0].id;
  } catch (e) {
    el.innerHTML = `<div class="center-note" style="padding:3rem;">Impossible de contacter le serveur TOUKY.<br>Vérifiez que le backend est démarré (node server.js).</div>`;
    return;
  }
  render();
})();

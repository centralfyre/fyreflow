const statusBanner = document.getElementById("status-banner");
const memberBar = document.getElementById("member-bar");
const memberPanel = document.getElementById("member-panel");
const refreshBtn = document.getElementById("refresh-btn");

const state = {
  members: [],
  delivered: new Map(), // memberId -> activities[]
  history: new Map(), // memberId -> activities[]
  upcoming: new Map(), // memberId -> activities[]
  selectedMemberId: null,
};

function showError(message) {
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden");
  setTimeout(() => statusBanner.classList.add("hidden"), 6000);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erro ao chamar ${url}`);
  }
  return data;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function formatDate(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return d.toLocaleDateString("pt-BR");
}

function formatGroupLabel(dateKey) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dateKey === todayKey) return "Hoje";
  if (dateKey === yesterdayKey) return "Ontem";
  return formatDate(dateKey);
}

function byMemberToMap(byMember) {
  const map = new Map();
  for (const entry of byMember || []) {
    map.set(entry.member.id, entry.activities);
  }
  return map;
}

function avatarNode(member, size) {
  if (member.avatarUrl) {
    const img = document.createElement("img");
    img.className = "member-avatar";
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.src = `${member.avatarUrl}/${size}.png`;
    img.alt = member.fullName;
    return img;
  }
  const div = document.createElement("div");
  div.className = "member-avatar";
  div.style.width = size + "px";
  div.style.height = size + "px";
  div.textContent = initials(member.fullName);
  return div;
}

function renderMemberBar() {
  memberBar.innerHTML = "";

  if (state.members.length === 0) {
    const p = document.createElement("p");
    p.className = "member-bar-loading";
    p.textContent = "Nenhum membro encontrado.";
    memberBar.appendChild(p);
    return;
  }

  for (const member of state.members) {
    const chip = document.createElement("button");
    chip.className = "member-chip" + (member.id === state.selectedMemberId ? " active" : "");
    chip.addEventListener("click", () => {
      state.selectedMemberId = member.id;
      renderMemberBar();
      renderMemberPanel();
    });

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "member-avatar-wrap";
    avatarWrap.appendChild(avatarNode(member, 52));

    const todayCount = (state.delivered.get(member.id) || []).length;
    if (todayCount > 0) {
      const badge = document.createElement("span");
      badge.className = "member-today-badge";
      badge.textContent = todayCount;
      avatarWrap.appendChild(badge);
    }

    const name = document.createElement("span");
    name.className = "member-name";
    name.textContent = member.fullName;

    chip.appendChild(avatarWrap);
    chip.appendChild(name);
    memberBar.appendChild(chip);
  }
}

function activityItemNode(activity, { showDelivered, showDue } = {}) {
  const a = document.createElement("a");
  a.className = "activity-item" + (activity.overdue ? " overdue" : "");
  a.href = activity.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const name = document.createElement("span");
  name.className = "activity-name";
  name.textContent = activity.name;
  a.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "activity-meta";

  if (activity.boardName) {
    const boardBadge = document.createElement("span");
    boardBadge.className = "badge board";
    boardBadge.textContent = activity.boardName;
    meta.appendChild(boardBadge);
  }

  if (activity.listName) {
    const listBadge = document.createElement("span");
    listBadge.className = "badge";
    listBadge.textContent = activity.listName;
    meta.appendChild(listBadge);
  }

  if (showDue && activity.due) {
    const dueBadge = document.createElement("span");
    dueBadge.className = "badge" + (activity.overdue ? " overdue" : "");
    dueBadge.textContent = (activity.overdue ? "Atrasada — " : "Prazo: ") + formatDate(activity.due);
    meta.appendChild(dueBadge);
  }

  if (showDelivered && activity.deliveredOn) {
    const deliveredBadge = document.createElement("span");
    deliveredBadge.className = "badge";
    deliveredBadge.textContent = `Entregue: ${formatDate(activity.deliveredOn)}`;
    meta.appendChild(deliveredBadge);
  }

  a.appendChild(meta);
  return a;
}

function renderSimpleSectionList(listEl, activities, emptyMessage, options) {
  listEl.innerHTML = "";
  if (!activities || activities.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    listEl.appendChild(empty);
    return;
  }
  for (const activity of activities) {
    const li = document.createElement("li");
    li.appendChild(activityItemNode(activity, options));
    listEl.appendChild(li);
  }
}

function renderHistorySectionList(listEl, activities) {
  listEl.innerHTML = "";
  if (!activities || activities.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhuma atividade no histórico recente.";
    listEl.appendChild(empty);
    return;
  }

  let lastGroup = null;
  for (const activity of activities) {
    if (activity.deliveredOn !== lastGroup) {
      lastGroup = activity.deliveredOn;
      const label = document.createElement("p");
      label.className = "history-group-label";
      label.textContent = formatGroupLabel(lastGroup);
      listEl.appendChild(label);
    }
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.appendChild(activityItemNode(activity, {}));
    listEl.appendChild(li);
  }
}

function buildSectionCard(title, listId) {
  const card = document.createElement("div");
  card.className = "section-card";

  const header = document.createElement("div");
  header.className = "section-card-header";

  const titleEl = document.createElement("span");
  titleEl.className = "section-title";
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const count = document.createElement("span");
  count.className = "section-count";
  count.id = listId + "-count";
  header.appendChild(count);

  const list = document.createElement("ul");
  list.className = "section-list";
  list.id = listId;

  card.appendChild(header);
  card.appendChild(list);
  return card;
}

function renderMemberPanel() {
  const member = state.members.find((m) => m.id === state.selectedMemberId);
  memberPanel.innerHTML = "";

  if (!member) {
    const p = document.createElement("p");
    p.className = "empty-state panel-placeholder";
    p.textContent = "Selecione uma pessoa acima para ver as atividades.";
    memberPanel.appendChild(p);
    return;
  }

  const header = document.createElement("div");
  header.className = "panel-header";
  header.appendChild(avatarNode(member, 44));

  const headerText = document.createElement("div");
  const name = document.createElement("div");
  name.className = "panel-header-name";
  name.textContent = member.fullName;
  const sub = document.createElement("div");
  sub.className = "panel-header-sub";
  sub.textContent = "Clique em qualquer atividade para abrir no Trello";
  headerText.appendChild(name);
  headerText.appendChild(sub);
  header.appendChild(headerText);

  const grid = document.createElement("div");
  grid.className = "section-grid";

  const deliveredCard = buildSectionCard("Entregues hoje", "section-delivered");
  const historyCard = buildSectionCard("Histórico", "section-history");
  const upcomingCard = buildSectionCard("Próximas a vencer", "section-upcoming");

  grid.appendChild(deliveredCard);
  grid.appendChild(historyCard);
  grid.appendChild(upcomingCard);

  memberPanel.appendChild(header);
  memberPanel.appendChild(grid);

  const delivered = state.delivered.get(member.id) || [];
  const history = state.history.get(member.id) || [];
  const upcoming = state.upcoming.get(member.id) || [];

  document.getElementById("section-delivered-count").textContent = delivered.length;
  document.getElementById("section-history-count").textContent = history.length;
  document.getElementById("section-upcoming-count").textContent = upcoming.length;

  renderSimpleSectionList(
    document.getElementById("section-delivered"),
    delivered,
    "Nenhuma atividade entregue hoje ainda.",
    {}
  );
  renderHistorySectionList(document.getElementById("section-history"), history);
  renderSimpleSectionList(
    document.getElementById("section-upcoming"),
    upcoming,
    "Nenhuma atividade com prazo pendente.",
    { showDue: true }
  );
}

async function loadAll() {
  try {
    const [membersRes, deliveredRes, historyRes, upcomingRes] = await Promise.all([
      fetchJSON("/api/members"),
      fetchJSON("/api/activities/delivered"),
      fetchJSON("/api/activities/history"),
      fetchJSON("/api/activities/upcoming"),
    ]);

    state.members = membersRes.members;
    state.delivered = byMemberToMap(deliveredRes.byMember);
    state.history = byMemberToMap(historyRes.byMember);
    state.upcoming = byMemberToMap(upcomingRes.byMember);

    if (!state.selectedMemberId && state.members.length > 0) {
      state.selectedMemberId = state.members[0].id;
    }

    renderMemberBar();
    renderMemberPanel();
  } catch (err) {
    showError(err.message);
  }
}

async function handleRefresh() {
  refreshBtn.classList.add("spinning");
  await loadAll();
  setTimeout(() => refreshBtn.classList.remove("spinning"), 700);
}

refreshBtn.addEventListener("click", handleRefresh);

loadAll();

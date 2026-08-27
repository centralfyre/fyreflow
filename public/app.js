const statusBanner = document.getElementById("status-banner");

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

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function isOverdueDue(due, dueComplete) {
  if (!due || dueComplete) return false;
  return new Date(due) < new Date();
}

function renderActivityItem(activity) {
  const li = document.createElement("li");
  li.className = "activity-item";

  const link = document.createElement("a");
  link.href = activity.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = activity.name;
  li.appendChild(link);

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

  if (activity.due) {
    const dueBadge = document.createElement("span");
    const overdue = isOverdueDue(activity.due, activity.dueComplete);
    dueBadge.className = "badge" + (overdue ? " overdue" : "");
    dueBadge.textContent = `Prazo: ${formatDate(activity.due)}`;
    meta.appendChild(dueBadge);
  }

  li.appendChild(meta);
  return li;
}

function renderMemberGrid(container, byMember, emptyMessage) {
  container.innerHTML = "";

  if (!byMember || byMember.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhum membro encontrado no(s) board(s) configurado(s).";
    container.appendChild(empty);
    return;
  }

  for (const entry of byMember) {
    const card = document.createElement("div");
    card.className = "member-card";

    const header = document.createElement("div");
    header.className = "member-card-header";

    if (entry.member.avatarUrl) {
      const img = document.createElement("img");
      img.className = "member-avatar";
      img.src = entry.member.avatarUrl + "/30.png";
      img.alt = entry.member.fullName;
      header.appendChild(img);
    } else {
      const avatar = document.createElement("div");
      avatar.className = "member-avatar";
      avatar.textContent = initials(entry.member.fullName);
      header.appendChild(avatar);
    }

    const name = document.createElement("span");
    name.className = "member-name";
    name.textContent = entry.member.fullName;
    header.appendChild(name);

    const count = document.createElement("span");
    count.className = "member-count";
    count.textContent = entry.activities.length;
    header.appendChild(count);

    card.appendChild(header);

    if (entry.activities.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = emptyMessage;
      card.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "activity-list";
      for (const activity of entry.activities) {
        list.appendChild(renderActivityItem(activity));
      }
      card.appendChild(list);
    }

    container.appendChild(card);
  }
}

async function loadDelivered() {
  const dateInput = document.getElementById("delivered-date");
  const container = document.getElementById("delivered-content");
  const date = dateInput.value;
  try {
    const url = date ? `/api/activities/delivered?date=${date}` : "/api/activities/delivered";
    const data = await fetchJSON(url);
    if (!dateInput.value) dateInput.value = data.date;
    renderMemberGrid(container, data.byMember, "Nenhuma atividade entregue nesse dia.");
  } catch (err) {
    showError(err.message);
  }
}

async function loadAll() {
  const container = document.getElementById("all-content");
  try {
    const data = await fetchJSON("/api/activities/all");
    renderMemberGrid(container, data.byMember, "Nenhuma atividade atribuída.");
  } catch (err) {
    showError(err.message);
  }
}

async function loadOverdue() {
  const container = document.getElementById("overdue-content");
  try {
    const data = await fetchJSON("/api/activities/overdue");
    renderMemberGrid(container, data.byMember, "Nenhuma atividade atrasada.");
  } catch (err) {
    showError(err.message);
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function setupControls() {
  document.getElementById("delivered-refresh").addEventListener("click", loadDelivered);
  document.getElementById("delivered-date").addEventListener("change", loadDelivered);
  document.getElementById("all-refresh").addEventListener("click", loadAll);
  document.getElementById("overdue-refresh").addEventListener("click", loadOverdue);
}

function init() {
  const dateInput = document.getElementById("delivered-date");
  dateInput.value = new Date().toISOString().slice(0, 10);

  setupTabs();
  setupControls();

  loadDelivered();
  loadAll();
  loadOverdue();
}

init();

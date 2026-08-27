const trello = require("./trello");

const DEFAULT_DONE_KEYWORDS = [
  "concluído",
  "concluido",
  "done",
  "feito",
  "entregue",
  "finalizado",
  "pronto",
];

function getDoneKeywords() {
  const raw = process.env.DONE_LIST_KEYWORDS;
  if (!raw) return DEFAULT_DONE_KEYWORDS;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isDoneListName(name) {
  const n = (name || "").toLowerCase();
  return getDoneKeywords().some((kw) => n.includes(kw));
}

// Simple in-memory caches to avoid hammering the Trello API on every request.
const BOARD_DATA_TTL_MS = 60 * 1000; // 1 minute
const DELIVERED_DATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let boardDataCache = { timestamp: 0, data: null };
const deliveredDateCache = new Map(); // cardId -> { date: 'YYYY-MM-DD', timestamp }

function toDateKey(isoString) {
  return new Date(isoString).toISOString().slice(0, 10);
}

// Resolves which boards to read: every open board in the configured
// Workspace(s) (TRELLO_WORKSPACE_IDS), plus any explicitly listed board IDs
// (TRELLO_BOARD_IDS). This lets the platform automatically pick up new
// client boards as they're created, instead of needing a manual env var
// update per board.
async function resolveBoards() {
  const workspaceIds = trello.getWorkspaceIds();
  const explicitIds = trello.getExplicitBoardIds();

  const boards = new Map(); // id -> { id, name }

  for (const workspaceId of workspaceIds) {
    const workspaceBoards = await trello.getWorkspaceBoards(workspaceId);
    for (const b of workspaceBoards) {
      boards.set(b.id, { id: b.id, name: b.name });
    }
  }

  for (const boardId of explicitIds) {
    if (!boards.has(boardId)) {
      const board = await trello.getBoard(boardId);
      boards.set(boardId, { id: board.id, name: board.name });
    }
  }

  if (boards.size === 0) {
    throw new Error(
      "Configure TRELLO_WORKSPACE_IDS (para ler todos os boards de uma ou mais Workspaces) e/ou TRELLO_BOARD_IDS (boards específicos)."
    );
  }

  return Array.from(boards.values());
}

async function fetchBoardData() {
  const now = Date.now();
  if (boardDataCache.data && now - boardDataCache.timestamp < BOARD_DATA_TTL_MS) {
    return boardDataCache.data;
  }

  const boards = await resolveBoards();

  const members = new Map(); // id -> { id, fullName, username, avatarUrl }
  const lists = new Map(); // id -> { id, name, boardId, isDone }
  const cards = [];

  for (const { id: boardId, name: boardName } of boards) {
    const [boardMembers, boardLists, boardCards] = await Promise.all([
      trello.getBoardMembers(boardId),
      trello.getBoardLists(boardId),
      trello.getBoardCards(boardId),
    ]);

    for (const m of boardMembers) {
      if (!members.has(m.id)) {
        members.set(m.id, {
          id: m.id,
          fullName: m.fullName || m.username,
          username: m.username,
          avatarUrl: m.avatarUrl || null,
        });
      }
    }

    for (const l of boardLists) {
      lists.set(l.id, {
        id: l.id,
        name: l.name,
        boardId,
        isDone: isDoneListName(l.name),
      });
    }

    for (const c of boardCards) {
      cards.push({
        id: c.id,
        name: c.name,
        due: c.due,
        dueComplete: c.dueComplete,
        idList: c.idList,
        idMembers: c.idMembers || [],
        dateLastActivity: c.dateLastActivity,
        url: c.shortUrl,
        boardId,
        boardName,
      });
    }
  }

  const data = { members, lists, cards };
  boardDataCache = { timestamp: now, data };
  return data;
}

// Determines the date a card most recently landed in a "done" list, using
// the card's move history. Falls back to dateLastActivity if the actions
// call fails or no matching action is found.
async function getDeliveredDate(card, doneListId) {
  const cached = deliveredDateCache.get(card.id);
  const now = Date.now();
  if (cached && now - cached.timestamp < DELIVERED_DATE_TTL_MS) {
    return cached.date;
  }

  let deliveredDate = toDateKey(card.dateLastActivity);

  try {
    const actions = await trello.getCardMoveActions(card.id);
    // actions come back newest-first from Trello
    const enteredDone = actions.find((a) => {
      if (a.type === "updateCard" && a.data && a.data.listAfter) {
        return a.data.listAfter.id === doneListId;
      }
      if (a.type === "createCard" && a.data && a.data.list) {
        return a.data.list.id === doneListId;
      }
      return false;
    });
    if (enteredDone) {
      deliveredDate = toDateKey(enteredDone.date);
    }
  } catch (err) {
    // Keep the fallback date; log for visibility without failing the request.
    console.warn(`Falha ao buscar histórico do card ${card.id}: ${err.message}`);
  }

  deliveredDateCache.set(card.id, { date: deliveredDate, timestamp: now });
  return deliveredDate;
}

function memberSummary(member) {
  return {
    id: member.id,
    fullName: member.fullName,
    username: member.username,
    avatarUrl: member.avatarUrl,
  };
}

function cardSummary(card, list, extra = {}) {
  return {
    id: card.id,
    name: card.name,
    due: card.due,
    dueComplete: card.dueComplete,
    listName: list ? list.name : null,
    boardName: card.boardName,
    url: card.url,
    ...extra,
  };
}

async function getMembers() {
  const { members } = await fetchBoardData();
  return Array.from(members.values()).map(memberSummary);
}

async function getDelivered(dateKey) {
  const { members, lists, cards } = await fetchBoardData();
  const targetDate = dateKey || toDateKey(new Date().toISOString());

  const doneCards = cards.filter((c) => {
    const list = lists.get(c.idList);
    return list && list.isDone;
  });

  const withDates = await Promise.all(
    doneCards.map(async (c) => ({
      card: c,
      deliveredOn: await getDeliveredDate(c, c.idList),
    }))
  );

  const matching = withDates.filter((x) => x.deliveredOn === targetDate);

  const byMember = Array.from(members.values()).map((member) => {
    const activities = matching
      .filter((x) => x.card.idMembers.includes(member.id))
      .map((x) => cardSummary(x.card, lists.get(x.card.idList)));
    return { member: memberSummary(member), activities };
  });

  return { date: targetDate, byMember };
}

function getHistoryLookbackDays() {
  const raw = Number(process.env.HISTORY_LOOKBACK_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

// Full delivery history per member: every card sitting in a "done" list
// whose last activity falls within the lookback window, with the date it
// entered that list. Older done cards are skipped (not just their action
// lookup, entirely) to keep this bounded on boards with lots of history.
async function getHistory() {
  const { members, lists, cards } = await fetchBoardData();
  const cutoff = Date.now() - getHistoryLookbackDays() * 24 * 60 * 60 * 1000;

  const doneCards = cards.filter((c) => {
    const list = lists.get(c.idList);
    if (!list || !list.isDone) return false;
    return new Date(c.dateLastActivity).getTime() >= cutoff;
  });

  const withDates = await Promise.all(
    doneCards.map(async (c) => ({
      card: c,
      deliveredOn: await getDeliveredDate(c, c.idList),
    }))
  );

  withDates.sort((a, b) => (a.deliveredOn < b.deliveredOn ? 1 : -1));

  const byMember = Array.from(members.values()).map((member) => {
    const activities = withDates
      .filter((x) => x.card.idMembers.includes(member.id))
      .map((x) => cardSummary(x.card, lists.get(x.card.idList), { deliveredOn: x.deliveredOn }));
    return { member: memberSummary(member), activities };
  });

  return { byMember, lookbackDays: getHistoryLookbackDays() };
}

// Cards with a due date that aren't in a "done" list yet, soonest due
// first. Overdue cards (due in the past) naturally sort to the top.
async function getUpcoming() {
  const { members, lists, cards } = await fetchBoardData();
  const now = new Date();

  const upcomingCards = cards.filter((c) => {
    const list = lists.get(c.idList);
    if (list && list.isDone) return false;
    if (!c.due || c.dueComplete) return false;
    return true;
  });

  upcomingCards.sort((a, b) => new Date(a.due) - new Date(b.due));

  const byMember = Array.from(members.values()).map((member) => {
    const activities = upcomingCards
      .filter((c) => c.idMembers.includes(member.id))
      .map((c) => cardSummary(c, lists.get(c.idList), { overdue: new Date(c.due) < now }));
    return { member: memberSummary(member), activities };
  });

  return { byMember };
}

module.exports = {
  getMembers,
  getDelivered,
  getHistory,
  getUpcoming,
};

const TRELLO_BASE = "https://api.trello.com/1";

function getCredentials() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error(
      "TRELLO_KEY e TRELLO_TOKEN precisam estar definidos nas variáveis de ambiente."
    );
  }
  return { key, token };
}

function getBoardIds() {
  const raw = process.env.TRELLO_BOARD_IDS || "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    throw new Error(
      "TRELLO_BOARD_IDS precisa ter ao menos um board ID (separe múltiplos por vírgula)."
    );
  }
  return ids;
}

async function trelloFetch(path, params = {}) {
  const { key, token } = getCredentials();
  const url = new URL(TRELLO_BASE + path);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello API ${res.status} em ${path}: ${body}`);
  }
  return res.json();
}

function getBoardMembers(boardId) {
  return trelloFetch(`/boards/${boardId}/members`, {
    fields: "fullName,username,avatarUrl",
  });
}

function getBoardLists(boardId) {
  return trelloFetch(`/boards/${boardId}/lists`, {
    fields: "name",
    filter: "open",
  });
}

function getBoardCards(boardId) {
  return trelloFetch(`/boards/${boardId}/cards`, {
    fields:
      "name,due,dueComplete,idList,idMembers,dateLastActivity,shortUrl,labels,closed",
    filter: "open",
  });
}

function getCardMoveActions(cardId) {
  return trelloFetch(`/cards/${cardId}/actions`, {
    filter: "updateCard:idList,createCard",
    limit: "50",
    fields: "date,data,type",
  });
}

function getBoard(boardId) {
  return trelloFetch(`/boards/${boardId}`, { fields: "name" });
}

module.exports = {
  getBoardIds,
  getBoardMembers,
  getBoardLists,
  getBoardCards,
  getCardMoveActions,
  getBoard,
};

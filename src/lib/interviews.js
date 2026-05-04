const STORAGE_KEY = "tg-app-interview-history-v1";

function safeParse(rawValue, fallback) {
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function toDisplayLevel(level) {
  const map = {
    junior: "Джуниор",
    middle: "Мидл",
    senior: "Сеньор",
    Джун: "Джун",
    Мид: "Мид",
    Сениор: "Сениор",
  };
  return map[level] || level || "Мид";
}

function toRelativeDate(createdAt) {
  const createdDate = new Date(createdAt);
  const nowDate = new Date();
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  );
  const startOfCreatedDay = new Date(
    createdDate.getFullYear(),
    createdDate.getMonth(),
    createdDate.getDate()
  );
  const daysDiff = Math.round(
    (startOfToday.getTime() - startOfCreatedDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff <= 0) return "сегодня";
  if (daysDiff === 1) return "вчера";
  return `${daysDiff} дн. назад`;
}

export function getInterviewHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const list = safeParse(raw, []);
  if (!Array.isArray(list)) return [];

  return list
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      position: item.position,
      company: item.company,
      level: toDisplayLevel(item.level),
      status: item.status,
      replies: `${item.replyCount || 0} реплик`,
      date: toRelativeDate(item.createdAt),
      createdAt: item.createdAt,
      replyCount: item.replyCount || 0,
      chatMessages: Array.isArray(item.chatMessages) ? item.chatMessages : [],
      review: item.review || null,
    }));
}

function normalizeServerStatus(raw) {
  const value = String(raw || "").toLowerCase();
  if (value === "offer" || value === "accepted") return "accepted";
  if (value === "rejected" || value === "reject") return "rejected";
  return "unknown";
}

export async function getInterviewHistoryWithServer(telegramId) {
  const localHistory = getInterviewHistory();
  const initData = window?.Telegram?.WebApp?.initData || "";
  const safeTelegramId = String(telegramId || "").trim();
  if ((!initData || initData.length <= 20) && !safeTelegramId) return localHistory;

  try {
    const response = await fetch("/api/user/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, telegramId: safeTelegramId }),
    });
    if (!response.ok) return localHistory;

    const payload = await response.json();
    const serverRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const serverHistory = serverRows.map((row) => ({
      id: String(row.id || `${row.telegram_id || "srv"}-${row.created_at || Date.now()}`),
      position: row.position || "Не указано",
      company: row.company || "IT сфера",
      level: toDisplayLevel(row.level),
      status: normalizeServerStatus(row.result),
      replies: `${Number(row.reply_count) || 0} реплик`,
      date: toRelativeDate(row.created_at || new Date().toISOString()),
      createdAt: row.created_at || new Date().toISOString(),
      replyCount: Number(row.reply_count) || 0,
      chatMessages: Array.isArray(row.chat_messages) ? row.chat_messages : [],
      review: row.debrief || null,
    }));

    const merged = [...localHistory];
    const seen = new Set(
      localHistory.map((item) => `${item.position}::${item.company}::${new Date(item.createdAt).toDateString()}`)
    );
    for (const item of serverHistory) {
      const key = `${item.position}::${item.company}::${new Date(item.createdAt).toDateString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return localHistory;
  }
}

export function saveInterviewResult(interview) {
  const existing = getInterviewHistory();
  const nextRecord = {
    id: interview.id,
    position: interview.position || "Не указано",
    company: interview.company || "IT сфера",
    level: interview.level || "middle",
    status: interview.status === "accepted" ? "accepted" : "rejected",
    replyCount: interview.replyCount || 0,
    createdAt: interview.createdAt || new Date().toISOString(),
    chatMessages: Array.isArray(interview.chatMessages) ? interview.chatMessages : [],
    review: interview.review || null,
  };

  const withoutCurrent = existing.filter((item) => item.id !== nextRecord.id);
  const toStore = [nextRecord, ...withoutCurrent];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function getInterviewStats() {
  const history = getInterviewHistory();
  const totalInterviews = history.length;
  const accepted = history.filter((item) => item.status === "accepted").length;
  const winRate = totalInterviews === 0 ? "0%" : `${Math.round((accepted / totalInterviews) * 100)}%`;

  return { totalInterviews, accepted, winRate };
}

export async function getInterviewStatsWithServer(telegramId) {
  const history = await getInterviewHistoryWithServer(telegramId);
  const totalInterviews = history.length;
  const accepted = history.filter((item) => item.status === "accepted").length;
  const winRate = totalInterviews === 0 ? "0%" : `${Math.round((accepted / totalInterviews) * 100)}%`;
  return { totalInterviews, accepted, winRate };
}

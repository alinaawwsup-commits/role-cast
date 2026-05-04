import { supabase } from "./supabase";

const LOCAL_PREMIUM_KEY = "local-premium-user-v1";
const LOCAL_INTERVIEWS_KEY = "local-interviews-v1";
const LOCAL_HISTORY_KEY = "tg-app-interview-history-v1";
const LOCAL_CREDITS_KEY = "local-interview-credits-v1";
const LOCAL_LAST_TELEGRAM_ID_KEY = "tg-last-id-v1";
const FREE_INTERVIEWS_TOTAL = 1;

function readLocalInterviews() {
  try {
    const raw = localStorage.getItem(LOCAL_INTERVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalInterviews(list) {
  localStorage.setItem(LOCAL_INTERVIEWS_KEY, JSON.stringify(list));
}

function getLocalInterviewsToday(telegramId) {
  const list = readLocalInterviews();
  const startOfTodayLocal = new Date();
  startOfTodayLocal.setHours(0, 0, 0, 0);
  return list.filter(
    (item) =>
      item.telegram_id === telegramId &&
      new Date(item.created_at).getTime() >= startOfTodayLocal.getTime()
  ).length;
}

function getLocalInterviewsTotal(telegramId) {
  const list = readLocalInterviews();
  return list.filter((item) => item.telegram_id === telegramId).length;
}

function getHistoryInterviewsToday() {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return 0;

    const startOfTodayLocal = new Date();
    startOfTodayLocal.setHours(0, 0, 0, 0);

    return list.filter(
      (item) => item?.createdAt && new Date(item.createdAt).getTime() >= startOfTodayLocal.getTime()
    ).length;
  } catch {
    return 0;
  }
}

function getHistoryInterviewsTotal() {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return 0;
    return list.length;
  } catch {
    return 0;
  }
}

function readLocalPremiumMap() {
  try {
    const raw = localStorage.getItem(LOCAL_PREMIUM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalPremiumMap(map) {
  localStorage.setItem(LOCAL_PREMIUM_KEY, JSON.stringify(map));
}

function readLocalCreditsMap() {
  try {
    const raw = localStorage.getItem(LOCAL_CREDITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalCreditsMap(map) {
  localStorage.setItem(LOCAL_CREDITS_KEY, JSON.stringify(map));
}

/*
SQL для ручного запуска в Supabase Dashboard:

CREATE TABLE interviews (
  id uuid default gen_random_uuid() primary key,
  telegram_id text not null,
  created_at timestamptz default now(),
  position text,
  company text,
  level text,
  result text,
  reply_count int,
  debrief jsonb
);

CREATE TABLE users (
  id uuid default gen_random_uuid() primary key,
  telegram_id text unique not null,
  is_premium boolean default false,
  package_credits int default 0,
  premium_until timestamptz,
  created_at timestamptz default now()
);

-- Если таблица users уже существует:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until timestamptz;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS package_credits int default 0;
*/

export function getTelegramId() {
  const unsafeId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (unsafeId) {
    const value = String(unsafeId);
    try {
      localStorage.setItem(LOCAL_LAST_TELEGRAM_ID_KEY, value);
    } catch {
      // ignore cache write errors
    }
    return value;
  }

  const initData = window?.Telegram?.WebApp?.initData || "";
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userRaw = params.get("user");
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        const parsedId = parsed?.id ? String(parsed.id) : "";
        if (parsedId) {
          try {
            localStorage.setItem(LOCAL_LAST_TELEGRAM_ID_KEY, parsedId);
          } catch {
            // ignore cache write errors
          }
          return parsedId;
        }
      }
    } catch {
      // ignore parsing errors
    }
  }

  try {
    const cachedId = localStorage.getItem(LOCAL_LAST_TELEGRAM_ID_KEY) || "";
    if (cachedId) return cachedId;
  } catch {
    // ignore cache read errors
  }

  const isLocalDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalDev) return "test_user_123";
  return "";
}

export async function getInterviewsToday(telegramId) {
  const startOfTodayLocal = new Date();
  startOfTodayLocal.setHours(0, 0, 0, 0);
  const localCount = getLocalInterviewsToday(telegramId);
  const historyCount = getHistoryInterviewsToday();

  if (!supabase) {
    return Math.max(localCount, historyCount);
  }

  try {
    const { count, error } = await supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("telegram_id", telegramId)
      .gte("created_at", startOfTodayLocal.toISOString());

    if (error) throw error;
    // local history key is not scoped by telegram_id; do not mix into account limits.
    return Math.max(count || 0, localCount);
  } catch {
    return Math.max(localCount, historyCount);
  }
}

async function getTotalInterviews(telegramId) {
  const localCount = getLocalInterviewsTotal(telegramId);
  const historyCount = getHistoryInterviewsTotal();

  if (!supabase) {
    return Math.max(localCount, historyCount);
  }

  try {
    const { count, error } = await supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("telegram_id", telegramId);

    if (error) throw error;
    return Math.max(count || 0, localCount);
  } catch {
    return Math.max(localCount, historyCount);
  }
}

async function getPurchasedCredits(telegramId) {
  const localMap = readLocalCreditsMap();
  const localValue = Number(localMap[telegramId] || 0);

  if (!supabase) {
    return Math.max(0, localValue);
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("package_credits")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (error) throw error;
    return Math.max(0, Number(data?.package_credits || 0), localValue);
  } catch {
    return Math.max(0, localValue);
  }
}

let localInterviewSyncChain = Promise.resolve();
/** Serializes every POST to /api/user/record-interview (sync + saveInterview) to avoid duplicate rows. */
let recordInterviewPostChain = Promise.resolve();

function postRecordInterview(initData, telegramId, interviewPayload) {
  recordInterviewPostChain = recordInterviewPostChain.then(() =>
    fetch("/api/user/record-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, telegramId, interview: interviewPayload }),
    }).catch((error) => {
      console.error("record-interview request failed", error);
      return new Response("", { status: 500 });
    })
  );
  return recordInterviewPostChain;
}

function syncLocalInterviewsToServer(initData, telegramId) {
  localInterviewSyncChain = localInterviewSyncChain.then(async () => {
    const all = readLocalInterviews();
    const keep = [];
    let anySynced = false;
    for (const item of all) {
      if (item.telegram_id !== telegramId) {
        keep.push(item);
        continue;
      }
      try {
        const res = await postRecordInterview(initData, telegramId, {
          position: item.position,
          company: item.company,
          level: item.level,
          result: item.result,
          reply_count: item.reply_count,
          debrief: item.debrief ?? null,
        });
        if (res.ok) {
          anySynced = true;
          continue;
        }
      } catch {
        // keep local copy
      }
      keep.push(item);
    }
    if (anySynced) writeLocalInterviews(keep);
  });
  return localInterviewSyncChain;
}

export async function getInterviewAccess(telegramId) {
  const initData =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";

  try {
    const fetchAccess = () =>
      fetch("/api/user/interview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, telegramId }),
      });

    let response = await fetchAccess();
    if (response.ok) {
      let payload = await response.json();
      if (
        payload?.ok &&
        typeof payload.remainingInterviews === "number" &&
        typeof payload.purchasedCredits === "number"
      ) {
        const serverUsed = Math.max(0, Number(payload.usedInterviews));
        const localUsed = getLocalInterviewsTotal(telegramId);
        if (initData && initData.length > 20 && localUsed > serverUsed) {
          await syncLocalInterviewsToServer(initData, telegramId);
          response = await fetchAccess();
          if (response.ok) {
            const next = await response.json();
            if (next?.ok) payload = next;
          }
        }

        const purchasedCredits = Math.max(0, Number(payload.purchasedCredits));
        const freeIncluded = Number(payload.freeIncluded) || FREE_INTERVIEWS_TOTAL;
        const totalAllowed = freeIncluded + purchasedCredits;
        const usedInterviews = Math.max(0, Number(payload.usedInterviews));
        const remainingInterviews = Math.max(0, totalAllowed - usedInterviews);
        return {
          freeIncluded,
          purchasedCredits,
          usedInterviews,
          totalAllowed,
          remainingInterviews,
        };
      }
    }
  } catch {
    // fall back to anon Supabase (may fail under strict RLS)
  }

  const [usedInterviews, purchasedCredits] = await Promise.all([
    getTotalInterviews(telegramId),
    getPurchasedCredits(telegramId),
  ]);
  const totalAllowed = FREE_INTERVIEWS_TOTAL + purchasedCredits;
  const remainingInterviews = Math.max(0, totalAllowed - usedInterviews);

  return {
    freeIncluded: FREE_INTERVIEWS_TOTAL,
    purchasedCredits,
    usedInterviews,
    totalAllowed,
    remainingInterviews,
  };
}

export async function saveInterview(data) {
  const initData =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  if (initData && initData.length > 20) {
    try {
      const res = await postRecordInterview(initData, data.telegram_id, {
        position: data.position,
        company: data.company,
        level: data.level,
        result: data.result,
        reply_count: data.reply_count,
        debrief: data.debrief ?? null,
        chat_messages: Array.isArray(data.chat_messages) ? data.chat_messages : [],
      });
      if (res.ok) {
        return;
      }
    } catch {
      // fall through to anon insert
    }
  }

  if (!supabase) {
    const list = readLocalInterviews();
    list.push({
      ...data,
      created_at: new Date().toISOString(),
    });
    writeLocalInterviews(list);
    return;
  }

  try {
    const { error } = await supabase.from("interviews").insert({
      telegram_id: data.telegram_id,
      position: data.position,
      company: data.company,
      level: data.level,
      result: data.result,
      reply_count: data.reply_count,
      debrief: data.debrief,
      chat_messages: Array.isArray(data.chat_messages) ? data.chat_messages : null,
    });

    if (error) throw error;

    const list = readLocalInterviews();
    list.push({
      ...data,
      created_at: new Date().toISOString(),
    });
    writeLocalInterviews(list);
  } catch {
    const list = readLocalInterviews();
    list.push({
      ...data,
      created_at: new Date().toISOString(),
    });
    writeLocalInterviews(list);
  }
}

export async function updateLatestInterviewDebrief(data, telegramId) {
  const initData =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  const safeTelegramId = String(telegramId || getTelegramId() || "").trim();
  if ((!initData || initData.length <= 20) && !safeTelegramId) return false;

  try {
    const response = await fetch("/api/user/update-latest-debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        telegramId: safeTelegramId,
        interview: {
          position: data.position,
          company: data.company,
          result: data.result,
          reply_count: data.reply_count,
          debrief: data.debrief,
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function isPremiumUser(telegramId) {
  const isActivePremium = (row) => {
    if (!row) return false;
    const untilRaw = row.premium_until;
    if (untilRaw) {
      const untilTs = new Date(untilRaw).getTime();
      if (!Number.isNaN(untilTs)) {
        return untilTs > Date.now();
      }
    }
    return Boolean(row.is_premium);
  };

  if (!supabase) {
    const map = readLocalPremiumMap();
    if (typeof map[telegramId] === "undefined") {
      map[telegramId] = false;
      writeLocalPremiumMap(map);
    }
    const value = map[telegramId];
    if (typeof value === "object" && value !== null) {
      return isActivePremium(value);
    }
    return Boolean(value) || Number(readLocalCreditsMap()[telegramId] || 0) > 0;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("is_premium,premium_until,package_credits")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert({ telegram_id: telegramId, is_premium: false, premium_until: null })
        .select("is_premium,premium_until,package_credits")
        .single();

      if (insertError) throw insertError;
      return isActivePremium(inserted);
    }

    return isActivePremium(data) || Number(data?.package_credits || 0) > 0;
  } catch {
    const map = readLocalPremiumMap();
    if (typeof map[telegramId] === "undefined") {
      map[telegramId] = false;
      writeLocalPremiumMap(map);
    }
    const value = map[telegramId];
    if (typeof value === "object" && value !== null) {
      return isActivePremium(value);
    }
    return Boolean(value) || Number(readLocalCreditsMap()[telegramId] || 0) > 0;
  }
}

export async function setPremiumUser(telegramId, isPremium) {
  if (!supabase) {
    const map = readLocalPremiumMap();
    map[telegramId] = Boolean(isPremium);
    writeLocalPremiumMap(map);
    return;
  }

  try {
    const { error } = await supabase.from("users").upsert(
      { telegram_id: telegramId, is_premium: Boolean(isPremium) },
      { onConflict: "telegram_id" }
    );

    if (error) throw error;
  } catch {
    const map = readLocalPremiumMap();
    map[telegramId] = Boolean(isPremium);
    writeLocalPremiumMap(map);
  }
}

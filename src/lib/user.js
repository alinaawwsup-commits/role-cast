import { supabase } from "./supabase";

const LOCAL_PREMIUM_KEY = "local-premium-user-v1";
const LOCAL_INTERVIEWS_KEY = "local-interviews-v1";
const LOCAL_HISTORY_KEY = "tg-app-interview-history-v1";

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
  created_at timestamptz default now()
);
*/

export function getTelegramId() {
  const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (!tgId) return "test_user_123";
  return String(tgId);
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
    return Math.max(count || 0, localCount, historyCount);
  } catch {
    return Math.max(localCount, historyCount);
  }
}

export async function saveInterview(data) {
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

export async function isPremiumUser(telegramId) {
  if (!supabase) {
    const map = readLocalPremiumMap();
    if (typeof map[telegramId] === "undefined") {
      map[telegramId] = false;
      writeLocalPremiumMap(map);
    }
    return Boolean(map[telegramId]);
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("is_premium")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert({ telegram_id: telegramId, is_premium: false })
        .select("is_premium")
        .single();

      if (insertError) throw insertError;
      return Boolean(inserted?.is_premium);
    }

    return Boolean(data.is_premium);
  } catch {
    const map = readLocalPremiumMap();
    if (typeof map[telegramId] === "undefined") {
      map[telegramId] = false;
      writeLocalPremiumMap(map);
    }
    return Boolean(map[telegramId]);
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

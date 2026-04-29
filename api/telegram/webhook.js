import { createClient } from "@supabase/supabase-js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const PACKAGE_CREDITS = {
  start: 10,
  boost: 30,
};

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is missing in environment variables.");
  }
  return token;
}

async function sendStartMessage(chatId) {
  const botToken = getBotToken();
  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Нажми кнопку «Открыть» внизу слева, чтобы запустить приложение 🚀",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || "Failed to send /start reply");
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const update = req.body || {};
    const messageText = String(update?.message?.text || "").trim();
    const chatId = update?.message?.chat?.id;

    if (messageText.startsWith("/start") && chatId) {
      await sendStartMessage(chatId);
      return res.status(200).json({ ok: true, handled: "start" });
    }

    const payment = update?.message?.successful_payment;
    const from = update?.message?.from;

    if (!payment || !from?.id) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    if (payment.currency !== "XTR") {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const telegramId = String(from.id);
    const payload = String(payment.invoice_payload || "");
    const packageMatch = payload.match(/^rolecast_pkg_(start|boost)_/);
    const packageId = packageMatch?.[1];
    const creditsToAdd = PACKAGE_CREDITS[packageId];
    if (!creditsToAdd) {
      return res.status(200).json({ ok: true, skipped: true });
    }
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: readError } = await supabaseAdmin
      .from("users")
      .select("package_credits")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (readError) throw readError;
    const nextCredits = Number(existing?.package_credits || 0) + creditsToAdd;

    const { error } = await supabaseAdmin.from("users").upsert(
      {
        telegram_id: telegramId,
        package_credits: nextCredits,
        is_premium: nextCredits > 0,
      },
      { onConflict: "telegram_id" }
    );

    if (error) {
      throw error;
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown webhook error",
    });
  }
}

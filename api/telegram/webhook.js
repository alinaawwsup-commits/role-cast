import { createClient } from "@supabase/supabase-js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const PACKAGE_CREDITS = {
  warmup: 3,
  battle: 10,
  boost: 25,
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

async function answerPreCheckoutQuery({ queryId, ok, errorMessage }) {
  const botToken = getBotToken();
  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/answerPreCheckoutQuery`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pre_checkout_query_id: queryId,
      ok,
      ...(ok ? {} : { error_message: errorMessage || "Платеж временно недоступен" }),
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || "Failed to answer pre_checkout_query");
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function applySuccessfulPayment({ payment, from }) {
  if (payment.currency !== "XTR") {
    return { ok: true, skipped: true, reason: "non_xtr" };
  }

  const telegramId = String(from.id);
  const payload = String(payment.invoice_payload || "");
  const packageMatch = payload.match(/^rolecast_pkg_(warmup|battle|boost)_/);
  const packageId = packageMatch?.[1];
  const creditsToAdd = PACKAGE_CREDITS[packageId];
  if (!creditsToAdd) {
    return { ok: true, skipped: true, reason: "unknown_package" };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRows, error: readError } = await supabaseAdmin
    .from("users")
    .select("package_credits")
    .eq("telegram_id", telegramId)
    .limit(1);

  if (readError) {
    console.error("Supabase read package_credits failed", readError);
    return { ok: false, error: readError.message || "read_failed" };
  }

  const existingCredits = Number(existingRows?.[0]?.package_credits || 0);
  const nextCredits = existingCredits + creditsToAdd;

  const { error } = await supabaseAdmin.from("users").upsert(
    {
      telegram_id: telegramId,
      package_credits: nextCredits,
      is_premium: nextCredits > 0,
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    console.error("Supabase upsert package_credits failed", error);
    return { ok: false, error: error.message || "upsert_failed" };
  }

  return { ok: true, creditsAdded: creditsToAdd, nextCredits };
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

    if (messageText.startsWith("/appss_verify") && chatId) {
      try {
        const botToken = getBotToken();
        const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: "appss_506437",
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          console.error("appss_verify sendMessage failed", data);
        }
      } catch (error) {
        console.error("appss_verify handler error", error);
      }
      return res.status(200).json({ ok: true, handled: "appss_verify" });
    }

    if (messageText.startsWith("/start") && chatId) {
      try {
        await sendStartMessage(chatId);
      } catch (error) {
        console.error("/start handler error", error);
      }
      return res.status(200).json({ ok: true, handled: "start" });
    }

    const preCheckoutQuery = update?.pre_checkout_query;
    if (preCheckoutQuery?.id) {
      try {
        const payload = String(preCheckoutQuery?.invoice_payload || "");
        const packageMatch = payload.match(/^rolecast_pkg_(warmup|battle|boost)_/);
        const isKnownPackage = Boolean(packageMatch?.[1]);
        await answerPreCheckoutQuery({
          queryId: preCheckoutQuery.id,
          ok: isKnownPackage,
          errorMessage: "Пакет не найден. Попробуйте снова.",
        });
      } catch (error) {
        console.error("pre_checkout_query handler error", error);
      }
      return res.status(200).json({ ok: true, handled: "pre_checkout_query" });
    }

    const payment = update?.message?.successful_payment;
    const from = update?.message?.from;

    if (!payment || !from?.id) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const paymentResult = await applySuccessfulPayment({ payment, from });
    if (!paymentResult.ok) {
      console.error("successful_payment not applied", paymentResult);
    }

    return res.status(200).json({ ok: true, payment: paymentResult });
  } catch (error) {
    console.error("telegram webhook fatal", error);
    return res.status(200).json({ ok: false, error: error instanceof Error ? error.message : "fatal" });
  }
}

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function addDaysIso(days) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const update = req.body || {};
    const payment = update?.message?.successful_payment;
    const from = update?.message?.from;

    if (!payment || !from?.id) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    if (payment.currency !== "XTR") {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const telegramId = String(from.id);
    const premiumUntil = addDaysIso(30);
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.from("users").upsert(
      {
        telegram_id: telegramId,
        is_premium: true,
        premium_until: premiumUntil,
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

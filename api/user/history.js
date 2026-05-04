import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { validateTelegramWebAppInitData } from "../lib/telegramInitData.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ ok: false, error: "BOT_TOKEN is not configured" });
  }

  const { initData, telegramId: telegramIdRaw } = req.body || {};
  const verifiedTelegramId = validateTelegramWebAppInitData(initData, botToken);
  const fallbackTelegramId = String(telegramIdRaw || "").trim();
  const telegramId = verifiedTelegramId || fallbackTelegramId;
  if (!telegramId) {
    return res.status(401).json({ ok: false, error: "invalid_init_data" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("interviews")
      .select("id,created_at,position,company,level,result,reply_count,debrief,chat_messages")
      .eq("telegram_id", telegramId)
      .order("created_at", { ascending: false })
      .limit(100);
    let { data, error } = await query;

    if (error) {
      const minimal = await supabaseAdmin
        .from("interviews")
        .select("id,created_at,position,company")
        .eq("telegram_id", telegramId)
        .order("created_at", { ascending: false })
        .limit(100);
      data = minimal.data;
      error = minimal.error;
    }

    if (error) {
      console.error("history read failed", error);
      return res.status(500).json({ ok: false, error: error.message || "history_read_failed" });
    }

    return res.status(200).json({ ok: true, rows: data || [] });
  } catch (error) {
    console.error("history fatal", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "server_error",
    });
  }
}

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

  const { initData, interview, telegramId: telegramIdRaw } = req.body || {};
  const verifiedTelegramId = validateTelegramWebAppInitData(initData, botToken);
  const fallbackTelegramId = String(telegramIdRaw || "").trim();
  const telegramId = verifiedTelegramId || fallbackTelegramId;
  if (!telegramId) {
    return res.status(401).json({ ok: false, error: "invalid_init_data" });
  }

  if (!interview || typeof interview !== "object" || !interview.debrief) {
    return res.status(400).json({ ok: false, error: "debrief is required" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const position = String(interview.position || "");
    const company = String(interview.company || "");
    const result = String(interview.result || "");
    const replyCount = Number(interview.reply_count) || 0;

    const { data: rows, error: readError } = await supabaseAdmin
      .from("interviews")
      .select("id")
      .eq("telegram_id", telegramId)
      .eq("position", position)
      .eq("company", company)
      .eq("result", result)
      .eq("reply_count", replyCount)
      .order("created_at", { ascending: false })
      .limit(1);

    if (readError) {
      return res.status(500).json({ ok: false, error: readError.message || "read_failed" });
    }

    const id = rows?.[0]?.id;
    if (!id) {
      return res.status(404).json({ ok: false, error: "interview_not_found" });
    }

    const { error: updateError } = await supabaseAdmin
      .from("interviews")
      .update({ debrief: interview.debrief })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message || "update_failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "server_error",
    });
  }
}

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

  if (!interview || typeof interview !== "object") {
    return res.status(400).json({ ok: false, error: "interview is required" });
  }

  const positionKey = String(interview.position ?? "").slice(0, 500);
  const companyKey = String(interview.company ?? "").slice(0, 500);

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const since = new Date(Date.now() - 20_000).toISOString();
    const { count: recentDupes, error: dupErr } = await supabaseAdmin
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("telegram_id", telegramId)
      .eq("position", positionKey)
      .eq("company", companyKey)
      .gte("created_at", since);

    if (!dupErr && (recentDupes || 0) > 0) {
      return res.status(200).json({ ok: true, insertMode: "deduped_recent" });
    }

    const fullRow = {
      telegram_id: telegramId,
      position: String(interview.position ?? ""),
      company: String(interview.company ?? ""),
      level: String(interview.level ?? ""),
      result: String(interview.result ?? ""),
      reply_count: Number(interview.reply_count) || 0,
      debrief: interview.debrief ?? null,
      chat_messages: Array.isArray(interview.chat_messages) ? interview.chat_messages : null,
    };

    let insertMode = "full";
    let { error } = await supabaseAdmin.from("interviews").insert(fullRow);

    if (error) {
      console.warn("record-interview full insert failed, trying minimal row", error.message);
      const minimalRow = {
        telegram_id: telegramId,
        position: String(interview.position || "Интервью").slice(0, 500),
        company: String(interview.company || "—").slice(0, 500),
      };
      insertMode = "minimal";
      const second = await supabaseAdmin.from("interviews").insert(minimalRow);
      error = second.error;
    }

    if (error) {
      console.error("record-interview insert failed", error);
      return res.status(500).json({ ok: false, error: error.message || "insert_failed" });
    }

    return res.status(200).json({ ok: true, insertMode });
  } catch (error) {
    console.error("record-interview fatal", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "server_error",
    });
  }
}

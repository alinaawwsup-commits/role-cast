const TELEGRAM_API_BASE = "https://api.telegram.org";
const STARS_PRICE = 250;

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is missing in environment variables.");
  }
  return token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { telegramId } = req.body || {};
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "telegramId is required" });
    }

    const botToken = getBotToken();
    const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/createInvoiceLink`;
    const payload = `rolecast_pro_${telegramId}_${Date.now()}`;

    const tgResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "RoleCast Pro",
        description: "10 интервью в день, все уровни, полный разбор.",
        payload,
        currency: "XTR",
        prices: [{ label: "RoleCast Pro / 30 дней", amount: STARS_PRICE }],
        provider_token: "",
      }),
    });

    const data = await tgResponse.json();
    if (!tgResponse.ok || !data?.ok) {
      return res.status(500).json({
        ok: false,
        error: data?.description || "Failed to create Telegram Stars invoice",
      });
    }

    return res.status(200).json({ ok: true, invoiceLink: data.result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}

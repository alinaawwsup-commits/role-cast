const TELEGRAM_API_BASE = "https://api.telegram.org";
const PACKAGES = {
  warmup: {
    id: "warmup",
    title: "Разминка",
    interviews: 3,
    stars: 100,
  },
  battle: {
    id: "battle",
    title: "Боевой режим",
    interviews: 10,
    stars: 300,
  },
  boost: {
    id: "boost",
    title: "Прокачка",
    interviews: 25,
    stars: 600,
  },
};

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
    const { telegramId, packageId } = req.body || {};
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "telegramId is required" });
    }
    const selectedPackage = PACKAGES[packageId];
    if (!selectedPackage) {
      return res.status(400).json({ ok: false, error: "Unknown packageId" });
    }

    const botToken = getBotToken();
    const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/createInvoiceLink`;
    const payload = `rolecast_pkg_${selectedPackage.id}_${telegramId}_${Date.now()}`;

    const tgResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `RoleCast · ${selectedPackage.title}`,
        description: `${selectedPackage.interviews} интервью в пакете`,
        payload,
        currency: "XTR",
        prices: [{ label: `${selectedPackage.title} (${selectedPackage.interviews} интервью)`, amount: selectedPackage.stars }],
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

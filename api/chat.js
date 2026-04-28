const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODELS_API_URL = "https://api.anthropic.com/v1/models";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
const MODEL_FALLBACKS = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

async function discoverAvailableModel(requestHeaders) {
  try {
    const response = await fetch(ANTHROPIC_MODELS_API_URL, {
      method: "GET",
      headers: requestHeaders,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const modelIds = Array.isArray(payload?.data) ? payload.data.map((item) => item.id) : [];
    if (!modelIds.length) return null;
    return (
      modelIds.find((id) => id.includes("sonnet")) ||
      modelIds.find((id) => id.includes("haiku")) ||
      modelIds[0]
    );
  } catch {
    return null;
  }
}

async function sendToAnthropic(messages, systemPrompt, apiKey) {
  const payload = {
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  };

  const requestHeaders = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  const modelsToTry = [DEFAULT_MODEL, ...MODEL_FALLBACKS].filter(
    (model, index, arr) => model && arr.indexOf(model) === index
  );

  let response = null;
  let lastErrorText = "";

  for (const model of modelsToTry) {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ ...payload, model }),
    });
    if (response.ok) break;
    lastErrorText = await response.text();
    if (response.status !== 404) break;
  }

  if (response && response.status === 404) {
    const discovered = await discoverAvailableModel(requestHeaders);
    if (discovered) {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ ...payload, model: discovered }),
      });
      if (!response.ok) {
        lastErrorText = await response.text();
      }
    }
  }

  if (!response || !response.ok) {
    const isModelNotFound =
      response?.status === 404 && lastErrorText.includes('"type":"not_found_error"');
    if (isModelNotFound) {
      throw new Error(
        "В этом API-ключе не найдено доступных моделей. Проверь ключ и workspace Anthropic."
      );
    }
    throw new Error(`Anthropic API error: ${response?.status || 0} ${lastErrorText}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is missing on server" });
  }

  try {
    const { messages, systemPrompt } = req.body || {};
    if (!Array.isArray(messages) || typeof systemPrompt !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const data = await sendToAnthropic(messages, systemPrompt, apiKey);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

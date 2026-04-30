const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODELS_API_URL = "https://api.anthropic.com/v1/models";
const SERVER_CHAT_ENDPOINT = "/api/chat";
const ANTHROPIC_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
const USE_MOCK_HR = import.meta.env.VITE_USE_MOCK_HR !== "false";
const ANTHROPIC_MODEL_FALLBACKS = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

export function buildSystemPrompt(position, company, level) {
  return `Ты — опытный HR менеджер компании ${company}.
Ты проводишь собеседование на должность ${position}.

Твоя личность:
- Профессиональный, сдержанный, внимательный
- Не грубый но требовательный
- Задаёшь конкретные вопросы, не принимаешь размытые ответы
- Если кандидат отвечает слабо — усиливаешь давление и скепсис
- Если кандидат отвечает сильно с конкретными фактами и цифрами — 
  немного смягчаешься но не сдаёшься сразу
- Знаешь специфику компании ${company} и задаёшь релевантные вопросы
- Учитываешь профессию кандидата (${position}), нишу/контекст компании (${company}) и уровень (${level}) в каждом вопросе
- Если кандидат уходит в оффтоп, пишет бред, токсичность или мат — сразу жёстко останавливаешь интервью

Уровень кандидата: ${level}.
Адаптируй сложность вопросов под этот уровень:
- Джун: базовые вопросы, мягкое давление, фокус на потенциале
- Мид: стандартные вопросы, умеренное давление, фокус на опыте
- Сениор: глубокие вопросы, жёсткий скептицизм, фокус на результатах

Структура интервью — веди собеседование в таком порядке:
1. Попроси кандидата рассказать о себе
2. Спроси почему хочет в эту компанию и на эту должность
3. Задай 2-3 вопроса про опыт и конкретные результаты
4. Спроси про сложную ситуацию или провал
5. Спроси про зарплатные ожидания
6. Дай кандидату задать вопросы тебе

Логика победы и поражения:
- Если кандидат хорошо ответил на большинство вопросов — 
  в конце напиши ТОЛЬКО эту фразу на отдельной строке: [OFFER]
- Если кандидат отвечал слабо или уклончиво — 
  в конце напиши ТОЛЬКО эту фразу на отдельной строке: [REJECTED]
- Выноси вердикт не раньше чем после 10-й реплики кандидата
- После вердикта больше ничего не пиши

Немедленное завершение интервью (исключение из правила 10 реплик):
- Если кандидат пишет бессмысленный текст, не относящийся к работе/вакансии, оскорбления, токсичные или нецензурные сообщения:
  1) Коротко и жёстко сообщи, что интервью прекращено из-за непрофессиональной коммуникации
  2) На новой строке выведи [REJECTED]
  3) После этого больше ничего не пиши
- Не предупреждай много раз: достаточно одного нарушения для завершения
- Не переходи в дружеский или шуточный тон в таких случаях

Важно:
- Всегда отвечай на том языке на котором пишет кандидат
- Ты никогда не выходишь из роли HR
- Не упоминай что ты ИИ
- Пиши коротко и по делу как настоящий HR — 2-4 предложения максимум
- Не нумеруй вопросы
- Между вопросами делай естественные переходы`;
}

function makeAnthropicLikeResponse(text) {
  return {
    id: "mock-response",
    model: "mock-hr-engine",
    role: "assistant",
    content: [{ type: "text", text }],
  };
}

function isReviewRequest(systemPrompt) {
  return (
    typeof systemPrompt === "string" &&
    (systemPrompt.includes("карьерному коучингу") ||
      systemPrompt.includes("Ответь строго в формате JSON"))
  );
}

function getInterviewContext(systemPrompt) {
  const positionMatch = systemPrompt.match(/должность\s(.+?)\./i);
  const companyMatch = systemPrompt.match(/компании\s(.+?)\./i);
  const levelMatch = systemPrompt.match(/Уровень кандидата:\s(.+?)\./i);
  const hrNameMatch = systemPrompt.match(/Тебя зовут\s(.+?)\n/i);

  return {
    position: positionMatch?.[1] || "специалиста",
    company: companyMatch?.[1] || "IT компании",
    level: levelMatch?.[1] || "Мид",
    hrName: hrNameMatch?.[1] || "Алексей",
  };
}

function scoreAnswer(text) {
  const normalized = text.toLowerCase();
  let score = 0;
  if (normalized.length > 80) score += 1;
  if (/\d|%/.test(normalized)) score += 1;
  if (/(увелич|сниз|рост|запуст|оптимиз|результат|конвер|выруч|retention)/i.test(normalized)) {
    score += 1;
  }
  if (/(не знаю|наверное|вроде|сложно сказать|не помню)/i.test(normalized)) score -= 1;
  return score;
}

function shouldHardReject(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) return false;

  const profanityPattern =
    /\b(бля|бляд|сук|хуй|хуе|пизд|еба|еби|ебн|нах|нахуй|мраз|долбо|идиот|туп(ой|ая)|fuck|shit|bitch)\b/i;
  const offTopicPattern =
    /\b(анекдот|мем|гороскоп|астролог|крипта|ставк|казино|порно|секс|политик|религ|рэп батл|котик|играю в доту)\b/i;
  const gibberishPattern = /^([^а-яa-z0-9]{0,3}|[а-яa-z]{1,2})$/i;

  return profanityPattern.test(normalized) || offTopicPattern.test(normalized) || gibberishPattern.test(normalized);
}

function getMockInterviewReply(messages, systemPrompt) {
  const { position, company, hrName } = getInterviewContext(systemPrompt);
  const userMessages = messages.filter(
    (message) =>
      message.role === "user" &&
      message.content !== "Начни интервью: задай первый вопрос кандидату по плану."
  );
  const turns = userMessages.length;
  const totalScore = userMessages.reduce((acc, message) => acc + scoreAnswer(message.content), 0);
  const avgScore = turns > 0 ? totalScore / turns : 0;
  const hasHardRejectSignal = userMessages.some((message) => shouldHardReject(message.content));

  if (hasHardRejectSignal) {
    return "Останавливаю интервью. Формат ответов не соответствует профессиональной коммуникации для этой роли.\n[REJECTED]";
  }

  if (turns >= 10) {
    const accepted = avgScore >= 1 || (turns >= 12 && avgScore >= 0.5);
    const verdictLine = accepted ? "[OFFER]" : "[REJECTED]";
    const closing = accepted
      ? "Спасибо, картина по вашему профилю понятна. Мы готовы двигаться дальше."
      : "Спасибо за ответы. На текущий момент профиль не совпадает с ожиданиями по роли.";
    return `${closing}\n${verdictLine}`;
  }

  const stageReplies = [
    `Здравствуйте! Я ${hrName}, HR компании ${company}. Давайте начнём наше интервью. В первую очередь скажите, почему вы хотите именно в ${company} и почему выбрали позицию ${position}?`,
    `Почему вы хотите именно в ${company} и почему выбрали позицию ${position}?`,
    "Приведите пример проекта, где вы дали измеримый результат. Какие были метрики до и после?",
    "Какую самую сложную задачу вы закрыли за последний год и в чём была ваша личная зона ответственности?",
    "Как вы приоритизируете задачи, когда дедлайн сдвигается и ресурсов не хватает?",
    "Расскажите про ситуацию, где вы допустили ошибку или провал. Что вы изменили после этого?",
    "Какие у вас зарплатные ожидания и на чём они основаны по рынку и вашему уровню?",
    "Что для вас критично в команде и менеджменте, чтобы вы были эффективны в первые 3 месяца?",
    "Какие риски вы видите в своём профиле для этой роли и как вы их закроете?",
    "Какие вопросы по роли или компании хотите задать мне как HR?",
  ];

  return stageReplies[Math.min(turns, stageReplies.length - 1)];
}

function clampMetric(value) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function getMockReview(messages) {
  const userMessages = messages.filter((message) => message.role === "user");
  const turns = userMessages.length;
  const totalScore = userMessages.reduce((acc, message) => acc + scoreAnswer(message.content), 0);
  const avgScore = turns > 0 ? totalScore / turns : 0;

  const confidence = clampMetric(5 + avgScore * 2);
  const argumentsScore = clampMetric(4 + avgScore * 2.3);
  const pressure = clampMetric(6 + (turns >= 10 ? 1 : 0) - avgScore * 0.8);

  const json = {
    confidence,
    arguments: argumentsScore,
    pressure,
    whatWorked:
      avgScore >= 1
        ? "Ты давал структурные ответы и подтверждал опыт конкретными результатами. Это усилило доверие HR."
        : "Ты держал диалог и отвечал по сути. Это помогло пройти базовые этапы собеседования.",
    whatToImprove:
      avgScore >= 1
        ? "Добавь больше деталей о личном вкладе в каждом кейсе и заранее готовь короткие истории про сложные ситуации."
        : "Нужны более конкретные примеры с цифрами и чёткой ролью в результате. Избегай общих формулировок без фактов.",
    bestAnswer:
      "В похожем кейсе я сначала зафиксировал целевую метрику, затем предложил 2 гипотезы, протестировал их и выбрал решение, которое дало +18% к ключевому показателю за 6 недель.",
  };

  return JSON.stringify(json, null, 2);
}

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

    const preferred =
      modelIds.find((id) => id.includes("sonnet")) ||
      modelIds.find((id) => id.includes("haiku")) ||
      modelIds[0];

    return preferred || null;
  } catch {
    return null;
  }
}

async function sendMessageDirect(messages, systemPrompt, apiKey) {
  const rawApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const safeApiKey = apiKey || (typeof rawApiKey === "string" ? rawApiKey.trim() : "");

  if (!safeApiKey) {
    throw new Error(
      "Не найден VITE_ANTHROPIC_API_KEY. Добавь ключ в .env и перезапусти npm run dev."
    );
  }

  // Header values must be Latin-1; Anthropic keys are ASCII only.
  if (!/^[\x00-\x7F]+$/.test(safeApiKey)) {
    throw new Error(
      "Ключ содержит не-латинские символы. Вставь API key вида sk-ant-... без кавычек и лишних символов."
    );
  }

  const payload = {
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  };

  const requestHeaders = {
    "Content-Type": "application/json",
    "x-api-key": safeApiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };

  const modelsToTry = [ANTHROPIC_MODEL, ...ANTHROPIC_MODEL_FALLBACKS].filter(
    (model, index, arr) => model && arr.indexOf(model) === index
  );

  let response = null;
  let lastErrorText = "";

  for (const model of modelsToTry) {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        ...payload,
        model,
      }),
    });

    if (response.ok) break;
    lastErrorText = await response.text();
    if (response.status !== 404) break;
  }

  if (response && response.status === 404) {
    const discoveredModel = await discoverAvailableModel(requestHeaders);
    if (discoveredModel) {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          ...payload,
          model: discoveredModel,
        }),
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
        "В этом API-ключе не найдено доступных моделей. Проверь, что ключ создан в том же workspace, где пополнен баланс Anthropic."
      );
    }
    throw new Error(`Anthropic API error: ${response?.status || 0} ${lastErrorText}`);
  }

  return response.json();
}

async function sendMessageViaServer(messages, systemPrompt) {
  const response = await fetch(SERVER_CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function sendMessage(messages, systemPrompt) {
  if (USE_MOCK_HR) {
    const text = isReviewRequest(systemPrompt)
      ? getMockReview(messages)
      : getMockInterviewReply(messages, systemPrompt);
    return makeAnthropicLikeResponse(text);
  }

  // In local Vite dev we keep direct mode to avoid requiring `vercel dev`.
  if (import.meta.env.DEV) {
    return sendMessageDirect(messages, systemPrompt);
  }

  return sendMessageViaServer(messages, systemPrompt);
}

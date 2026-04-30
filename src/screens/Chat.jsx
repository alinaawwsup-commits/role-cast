import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { buildSystemPrompt, sendMessage } from "../lib/anthropic";
import { saveInterviewResult } from "../lib/interviews";
import { saveInterview } from "../lib/user";
import { useAuth } from "../context/AuthContext";
import Paywall from "../components/Paywall";

const MAX_REPLIES = 15;
const HR_NAMES = ["Алексей", "Ирина", "Дмитрий", "Анна", "Максим", "Ольга", "Кирилл", "Мария"];
const HR_GENDER_BY_NAME = {
  Алексей: "male",
  Дмитрий: "male",
  Максим: "male",
  Кирилл: "male",
  Ирина: "female",
  Анна: "female",
  Ольга: "female",
  Мария: "female",
};
const REVIEW_PROMPT = `Ты — эксперт по карьерному коучингу. 
Проанализируй это собеседование и дай обратную связь кандидату.

Ответь строго в формате JSON и ничего кроме JSON:
{
  confidence: число от 1 до 10,
  arguments: число от 1 до 10,
  pressure: число от 1 до 10,
  whatWorked: строка 1-2 предложения,
  whatToImprove: строка 1-2 предложения,
  bestAnswer: строка — лучший альтернативный ответ 
               на самый слабый момент в интервью
}`;

function getLevelLabel(level) {
  const levelMap = {
    junior: "Джуниор",
    middle: "Мидл",
    senior: "Сеньор",
    Джун: "Джуниор",
    Мид: "Мидл",
    Сениор: "Сеньор",
  };

  return levelMap[level] || level || "Уровень не указан";
}

function getProgressTone(replyCount) {
  if (replyCount >= 14) return "#D84040";
  if (replyCount >= 12) return "#E8A020";
  return "var(--color-accent)";
}

function extractTextFromAnthropicResponse(payload) {
  if (!payload?.content?.length) return "";
  return payload.content
    .filter((chunk) => chunk.type === "text")
    .map((chunk) => chunk.text)
    .join("\n")
    .trim();
}

function toAnthropicMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function toAnthropicReviewMessages(messages) {
  const normalized = toAnthropicMessages(messages);
  const lastRole = normalized[normalized.length - 1]?.role;
  if (lastRole === "user") return normalized;

  return [
    ...normalized,
    {
      role: "user",
      content: "Сделай разбор интервью по этим сообщениям и верни только JSON по инструкции.",
    },
  ];
}

function toAnthropicRequestMessages(messages) {
  const normalized = toAnthropicMessages(messages);
  if (normalized.length > 0) return normalized;

  return [
    {
      role: "user",
      content: "Начни интервью: задай первый вопрос кандидату по плану.",
    },
  ];
}

function parseReviewJson(rawText) {
  const cleaned = rawText.trim().replace(/```json|```/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  const toResult = (source) => ({
    confidence: Math.max(1, Math.min(10, Number(source.confidence) || 6)),
    arguments: Math.max(1, Math.min(10, Number(source.arguments) || 6)),
    pressure: Math.max(1, Math.min(10, Number(source.pressure) || 6)),
    whatWorked:
      source.whatWorked ||
      "Ты держал структуру диалога и отвечал по теме, это помогло пройти ключевые этапы интервью.",
    whatToImprove:
      source.whatToImprove ||
      "Добавь больше конкретики, цифр и личного вклада в каждый пример, чтобы ответы звучали убедительнее.",
    bestAnswer:
      source.bestAnswer ||
      "В этой ситуации я бы начал с цели по метрике, предложил 2-3 гипотезы, проверил их и выбрал решение с лучшим результатом.",
  });

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    return toResult(parsed);
  } catch {
    const scoreFromText = (label) => {
      const match = cleaned.match(new RegExp(`${label}\\s*[:=]\\s*(\\d{1,2})`, "i"));
      return match ? Number(match[1]) : 6;
    };

    const fallback = {
      confidence: scoreFromText("confidence"),
      arguments: scoreFromText("arguments"),
      pressure: scoreFromText("pressure"),
      whatWorked: cleaned.slice(0, 180),
    };
    return toResult(fallback);
  }
}

function splitVerdict(responseText) {
  if (responseText.includes("[OFFER]")) {
    return { result: "offer", cleanText: responseText.replace("[OFFER]", "").trim() };
  }
  if (responseText.includes("[REJECTED]")) {
    return { result: "rejected", cleanText: responseText.replace("[REJECTED]", "").trim() };
  }
  return { result: null, cleanText: responseText };
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function Chat() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { telegramId, interviewAccess, refreshInterviewAccess } = useAuth();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [replyCount, setReplyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isFinishModalOpen, setFinishModalOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isReviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewData, setReviewData] = useState(null);
  const [isPaywallOpen, setPaywallOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const runRef = useRef({ started: false, requestId: 0 });
  const interviewIdRef = useRef(`int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const messagesEndRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const savedToSupabaseRef = useRef(false);
  const hrNameRef = useRef(HR_NAMES[Math.floor(Math.random() * HR_NAMES.length)]);
  const recognitionRef = useRef(null);

  const isReadOnly = Boolean(state?.readOnly);
  const isClosed = Boolean(state?.closed);
  const isActiveChat = !isReadOnly;
  const title = state?.position ? `Интервью: ${state.position}` : "Интервью";
  const subtitle = state?.company
    ? `${state.company} · ${getLevelLabel(state.level)}`
    : "Симуляция HR-диалога";
  const levelLabel = getLevelLabel(state?.level || "Мид");
  const systemPrompt = useMemo(
    () => {
      const hrGender = HR_GENDER_BY_NAME[hrNameRef.current] || "male";
      const grammarHint =
        hrGender === "female"
          ? "Ты говоришь от женского лица и используешь женские формы: «я поняла», «я посмотрела», «я готова»."
          : "Ты говоришь от мужского лица и используешь мужские формы: «я понял», «я посмотрел», «я готов».";

      return `${buildSystemPrompt(
        state?.position || "Специалист",
        state?.company || "IT сфера",
        levelLabel
      )}

Дополнение по роли:
- Тебя зовут ${hrNameRef.current}
- В первом сообщении коротко представься по имени.
- Не меняй имя в ходе интервью.
- ${grammarHint}`;
    },
    [state?.position, state?.company, levelLabel]
  );
  const progressPercent = Math.min((replyCount / MAX_REPLIES) * 100, 100);
  const progressColor = getProgressTone(replyCount);
  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;
  const canUseSpeech = typeof SpeechRecognitionCtor === "function";

  const closeReadOnlyChat = () => navigate("/history");
  const requestFinishChat = () => setFinishModalOpen(true);

  const finalizeGame = (nextResult, options = {}) => {
    const { immediate = false } = options;
    if (gameOver) return;
    runRef.current.requestId += 1;
    setIsLoading(false);
    setResult(nextResult);
    setGameOver(true);
    if (finishTimeoutRef.current) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    if (immediate) {
      setShowResult(true);
      return;
    }
    finishTimeoutRef.current = window.setTimeout(() => {
      setShowResult(true);
      finishTimeoutRef.current = null;
    }, 1000);
  };

  const fetchReview = async (chatMessages) => {
    if (isReadOnly || !chatMessages.length) return;

    setReviewLoading(true);
    setReviewError("");

    try {
      const response = await sendMessage(
        toAnthropicReviewMessages(chatMessages),
        `${systemPrompt}\n\n${REVIEW_PROMPT}`
      );
      const raw = extractTextFromAnthropicResponse(response);
      const parsed = parseReviewJson(raw);
      setReviewData(parsed);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Что-то пошло не так. Попробуй ещё раз."
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const runAssistantTurn = async (nextMessages, nextReplyCount) => {
    runRef.current.requestId += 1;
    const currentRequestId = runRef.current.requestId;
    setIsLoading(true);

    try {
      const response = await sendMessage(toAnthropicRequestMessages(nextMessages), systemPrompt);
      await sleep(450);
      if (runRef.current.requestId !== currentRequestId || gameOver) return;

      const rawText = extractTextFromAnthropicResponse(response);
      const { result: verdict, cleanText } = splitVerdict(rawText);
      if (cleanText) {
        setMessages((prev) => [...prev, { role: "assistant", content: cleanText }]);
      }

      if (verdict) {
        finalizeGame(verdict);
      } else if (nextReplyCount >= MAX_REPLIES) {
        finalizeGame("rejected");
      }
    } catch (error) {
      if (runRef.current.requestId !== currentRequestId || gameOver) return;
      const errorText =
        error instanceof Error ? error.message : "Что-то пошло не так. Попробуй ещё раз.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorText,
        },
      ]);
    } finally {
      if (runRef.current.requestId === currentRequestId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isReadOnly) {
      const mapped = (state?.messages || []).map((message) => ({
        role: message.role === "candidate" ? "user" : "assistant",
        content: message.text || message.content || "",
      }));
      setMessages(mapped);
      setReplyCount(mapped.filter((message) => message.role === "user").length);
      setGameOver(Boolean(isClosed));
      return;
    }

    if (runRef.current.started) return;
    runRef.current.started = true;
    runAssistantTurn([], 0);
  }, [isReadOnly, state?.messages, isClosed]);

  useEffect(() => {
    if (!gameOver || reviewData || isReviewLoading || reviewError || isReadOnly) return;
    fetchReview(messages);
  }, [gameOver, reviewData, isReviewLoading, reviewError, isReadOnly, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!gameOver || isReadOnly || !result) return;

    const chatMessages = messages.map((message) => ({
      role: message.role === "user" ? "candidate" : "hr",
      text: message.content,
    }));

    saveInterviewResult({
      id: interviewIdRef.current,
      position: state?.position,
      company: state?.company,
      level: state?.level,
      status: result === "offer" ? "accepted" : "rejected",
      replyCount,
      chatMessages,
      review: reviewData,
    });
  }, [gameOver, isReadOnly, result, messages, replyCount, reviewData, state?.position, state?.company, state?.level]);

  useEffect(() => {
    if (!gameOver || isReadOnly || !result || savedToSupabaseRef.current) return;

    const persist = async () => {
      try {
        await saveInterview({
          telegram_id: telegramId,
          position: state?.position || "",
          company: state?.company || "",
          level: state?.level || "",
          result,
          reply_count: replyCount,
          debrief: reviewData || null,
        });
        savedToSupabaseRef.current = true;
        await refreshInterviewAccess(telegramId);
      } catch (error) {
        console.error("Failed to save interview in Supabase", error);
      }
    };

    persist();
  }, [
    gameOver,
    isReadOnly,
    result,
    telegramId,
    replyCount,
    state?.position,
    state?.company,
    state?.level,
    refreshInterviewAccess,
  ]);

  useEffect(
    () => () => {
      if (finishTimeoutRef.current) {
        window.clearTimeout(finishTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    },
    []
  );

  const startVoiceInput = () => {
    if (!canUseSpeech || isReadOnly || isLoading || gameOver || isRecording) return;
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "ru-RU";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || "";
        if (transcript) {
          setDraft(transcript);
        }
      };
      recognition.onerror = () => {
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch (error) {
      console.error("Voice input is unavailable", error);
      setIsRecording(false);
    }
  };

  const sendUserMessage = async () => {
    const userText = draft.trim();
    if (!userText || isReadOnly || isLoading || gameOver || replyCount >= MAX_REPLIES) return;

    const nextReplyCount = replyCount + 1;
    const nextMessages = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setReplyCount(nextReplyCount);
    setDraft("");

    await runAssistantTurn(nextMessages, nextReplyCount);
  };

  const finishChat = () => {
    setFinishModalOpen(false);
    finalizeGame("rejected", { immediate: true });
  };

  const goHome = () => navigate("/");

  const openReviewModal = () => {
    setShowResult(false);
    setShowReview(true);
    if (!reviewData && !isReviewLoading && !reviewError) {
      fetchReview(messages);
    }
  };

  return (
    <section className="chat-screen">
      <header className="chat-header">
        <div className="chat-head-top">
          {isReadOnly && isClosed && (
            <button className="chat-back-chevron" onClick={closeReadOnlyChat} aria-label="Назад">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M14.5 6L8.5 12L14.5 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <div className="chat-heading-block">
            <h1 className="chat-title">{title}</h1>
            <p className="chat-subtitle">{subtitle}</p>
          </div>
          {isActiveChat && (
            <button className="chat-finish-btn" onClick={requestFinishChat}>
              Завершить чат
            </button>
          )}
        </div>
        {isReadOnly && isClosed && (
          <p className="chat-readonly-note">
            Этот чат закрыт. Можно только просматривать переписку.
          </p>
        )}
        {isActiveChat && (
          <div className="chat-progress-wrap">
            <div className="chat-progress-track">
              <span
                className="chat-progress-fill"
                style={{ width: `${progressPercent}%`, background: progressColor }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
            className={`chat-bubble ${message.role === "user" ? "candidate" : "hr"}`}
          >
            {message.content}
          </article>
        ))}
        {isLoading && (
          <article className="chat-bubble hr chat-typing-bubble" aria-label="HR печатает">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </article>
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={2}
          placeholder={
            isReadOnly ? "Чат закрыт для новых сообщений" : "Введите сообщение..."
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendUserMessage();
            }
          }}
          disabled={isReadOnly || isLoading || gameOver}
        />
        <div className="chat-input-actions">
          {!isReadOnly && canUseSpeech && (
            <button
              className={`chat-mic-btn ${isRecording ? "recording" : ""}`.trim()}
              aria-label="Голосовой ввод"
              onClick={startVoiceInput}
              disabled={isLoading || gameOver || isRecording}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="9"
                  y="3"
                  width="6"
                  height="12"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M6 11.2C6 14.5 8.69 17.2 12 17.2C15.31 17.2 18 14.5 18 11.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M12 17.2V20.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M9.5 20.2H14.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          {!isReadOnly && draft.trim() && (
            <button
              className="chat-send-btn"
              aria-label="Отправить сообщение"
              onClick={sendUserMessage}
              disabled={isLoading || gameOver}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 3L10 14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 3L14 21L10 14L3 10L21 3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </footer>

      <Modal isOpen={isFinishModalOpen} onClose={() => setFinishModalOpen(false)}>
        <div className="chat-finish-modal">
          <h3 className="chat-finish-modal-title">Завершить интервью?</h3>
          <p className="chat-finish-modal-text">
            Вы уверены, что хотите завершить интервью? В таком случае интервью будет
            отмечено как "Отказ".
          </p>
          <button
            className="chat-finish-modal-primary-btn"
            onClick={() => setFinishModalOpen(false)}
          >
            Продолжить интервью
          </button>
          <button className="history-modal-secondary-btn" onClick={finishChat}>
            Да, завершить
          </button>
        </div>
      </Modal>

      <Modal isOpen={showResult} onClose={() => {}} closeOnOverlay={false}>
        <div className="chat-result-modal">
          <div className="chat-result-icon-wrap">
            {result === "offer" ? (
              <svg viewBox="0 0 48 48" fill="none" className="chat-result-icon offer">
                <circle cx="24" cy="24" r="21" fill="currentColor" opacity="0.12" />
                <circle cx="18.5" cy="20" r="1.9" fill="currentColor" />
                <circle cx="29.5" cy="20" r="1.9" fill="currentColor" />
                <path
                  d="M16.5 28.6C18.6 31.2 21.1 32.4 24 32.4C26.9 32.4 29.4 31.2 31.5 28.6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 48 48" fill="none" className="chat-result-icon rejected">
                <circle cx="24" cy="24" r="21" fill="currentColor" opacity="0.12" />
                <circle cx="18.5" cy="20" r="1.9" fill="currentColor" />
                <circle cx="29.5" cy="20" r="1.9" fill="currentColor" />
                <path
                  d="M16.5 31C18.4 28.6 20.9 27.4 24 27.4C27.1 27.4 29.6 28.6 31.5 31"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <h3 className={`chat-result-title ${result === "offer" ? "offer" : "rejected"}`}>
            {result === "offer" ? "Оффер получен" : "Отказ"}
          </h3>
          <p className="chat-result-subtitle">
            {result === "offer"
              ? "HR решил что ты подходишь на эту должность"
              : "В этот раз не получилось. Попробуй ещё раз."}
          </p>
          <button className="history-modal-close-btn" onClick={openReviewModal}>
            Смотреть разбор
          </button>
          <button className="history-modal-secondary-btn" onClick={goHome}>
            На главную
          </button>
        </div>
      </Modal>

      <Modal isOpen={showReview} onClose={() => setShowReview(false)}>
        <div className="chat-review-modal history-modal-content">
          <div className="history-modal-head">
            <h3 className="history-modal-title">Разбор интервью</h3>
          </div>
          {isReviewLoading && <p className="chat-review-loading">Загружаем разбор...</p>}

          {!isReviewLoading && reviewError && (
            <div className="chat-review-error-wrap">
              <p className="chat-review-error">{reviewError}</p>
              <button className="history-modal-close-btn" onClick={() => fetchReview(messages)}>
                Повторить
              </button>
            </div>
          )}

          {!isReviewLoading && !reviewError && reviewData && (
            <>
              <div className="history-modal-metrics">
                <article className="history-modal-metric-card">
                  <span className="history-modal-metric-value">{reviewData.confidence}/10</span>
                  <span className="history-modal-metric-label">Уверенность</span>
                </article>
                <article className="history-modal-metric-card">
                  <span className="history-modal-metric-value">{reviewData.arguments}/10</span>
                  <span className="history-modal-metric-label">Аргументы</span>
                </article>
                <article className="history-modal-metric-card">
                  <span className="history-modal-metric-value">{reviewData.pressure}/10</span>
                  <span className="history-modal-metric-label">Давление</span>
                </article>
              </div>

              <section className="history-modal-section">
                <h4 className="history-modal-section-title good">Что сработало</h4>
                <p className="history-modal-section-text good-bg">{reviewData.whatWorked}</p>
              </section>

              <section className="history-modal-section">
                <h4 className="history-modal-section-title bad">Что улучшить</h4>
                <p className="history-modal-section-text bad-bg">{reviewData.whatToImprove}</p>
              </section>

              <section className="history-modal-section">
                <h4 className="history-modal-section-title neutral">Лучший ответ</h4>
                <p className="history-modal-section-text neutral-bg best-answer">
                  {reviewData.bestAnswer}
                </p>
              </section>

              <button className="history-modal-secondary-btn chat-review-home-btn" onClick={goHome}>
                На главную
              </button>
            </>
          )}
        </div>
      </Modal>
      <Paywall isOpen={isPaywallOpen} onClose={() => setPaywallOpen(false)} />
    </section>
  );
}

export default Chat;

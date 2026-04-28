import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { getInterviewHistory } from "../lib/interviews";
import { useAuth } from "../context/AuthContext";

function getLevelLabel(level) {
  const levelMap = {
    junior: "Джуниор",
    middle: "Мидл",
    senior: "Сеньор",
    Джун: "Джуниор",
    Мид: "Мидл",
    Сениор: "Сеньор",
  };

  return levelMap[level] || level;
}

function History() {
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);

  useEffect(() => {
    const loadHistory = () => setMatches(getInterviewHistory());
    loadHistory();
    window.addEventListener("focus", loadHistory);
    return () => window.removeEventListener("focus", loadHistory);
  }, []);

  const stats = useMemo(() => {
    const totalInterviews = matches.length;
    const accepted = matches.filter((item) => item.status === "accepted").length;
    const winRate =
      totalInterviews === 0 ? "0%" : `${Math.round((accepted / totalInterviews) * 100)}%`;
    return { totalInterviews, accepted, winRate };
  }, [matches]);
  const metrics = useMemo(
    () => [
      { label: "Интервью", value: String(stats.totalInterviews) },
      { label: "Оффер", value: String(stats.accepted), isAccent: true },
      { label: "Винрейт", value: stats.winRate },
    ],
    [stats]
  );

  const statusLabel = activeMatch?.status === "accepted" ? "Оффер" : "Отказ";
  const hasMatches = matches.length > 0;

  const openReadOnlyChat = () => {
    if (!activeMatch) return;

    navigate("/chat", {
      state: {
        readOnly: true,
        closed: true,
        position: activeMatch.position,
        company: activeMatch.company,
        level: activeMatch.level,
        replyLimit: activeMatch.replies,
        messages: activeMatch.chatMessages,
      },
    });
    setActiveMatch(null);
  };

  return (
    <section className="history-screen">
      <header className="history-header">
        <h1 className="history-title">История интервью</h1>
        <div className="history-metrics">
          {metrics.map((metric) => (
            <article key={metric.label} className="history-metric-card">
              <span className={`history-metric-value ${metric.isAccent ? "accent" : ""}`}>
                {metric.value}
              </span>
              <span className="history-metric-label">{metric.label}</span>
            </article>
          ))}
        </div>
      </header>

      <div className="history-list">
        {hasMatches ? (
          matches.map((match) => {
            const isAccepted = match.status === "accepted";
            return (
              <article
                key={match.id}
                className={`history-match-card ${isAccepted ? "accepted" : "rejected"}`}
                onClick={() => setActiveMatch(match)}
              >
                <div className="history-match-main">
                  <div className="history-match-info">
                    <div className="history-match-top">
                      <h2 className="history-match-position">{match.position}</h2>
                      <span
                        className={`history-status-tag ${isAccepted ? "accepted" : "rejected"}`}
                      >
                        {isAccepted ? "Оффер" : "Отказ"}
                      </span>
                    </div>
                    <p className="history-match-meta">
                      {match.company} · {getLevelLabel(match.level)} · {match.replies} · {match.date}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="history-empty">
            <svg
              className="history-empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 6.5C5 5.67 5.67 5 6.5 5H17.5C18.33 5 19 5.67 19 6.5V14.5C19 15.33 18.33 16 17.5 16H11.8L8.3 18.8C7.65 19.32 6.7 18.86 6.7 18.03V16H6.5C5.67 16 5 15.33 5 14.5V6.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="10.5" r="1" fill="currentColor" />
              <circle cx="12" cy="10.5" r="1" fill="currentColor" />
              <circle cx="15" cy="10.5" r="1" fill="currentColor" />
            </svg>
            <p className="history-empty-title">Интервью пока не было</p>
            <p className="history-empty-subtitle">Начните свое первое интервью</p>
            <button className="history-empty-btn" onClick={() => navigate("/")}>
              Пройти интервью
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(activeMatch)} onClose={() => setActiveMatch(null)}>
        {activeMatch && (
          <div className="history-modal-content">
            <div className="history-modal-head">
              <div className="history-modal-title-row">
                <h3 className="history-modal-title">{activeMatch.position}</h3>
                <span
                  className={`history-status-tag ${
                    activeMatch.status === "accepted" ? "accepted" : "rejected"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="history-modal-meta">
                {activeMatch.company} · {getLevelLabel(activeMatch.level)}
              </p>
            </div>

            <div className="history-modal-metrics">
              <article className="history-modal-metric-card">
                <span className="history-modal-metric-value">
                  {activeMatch.review?.confidence ?? 0}/10
                </span>
                <span className="history-modal-metric-label">Уверенность</span>
              </article>
              <article className="history-modal-metric-card">
                <span className="history-modal-metric-value">
                  {activeMatch.review?.arguments ?? 0}/10
                </span>
                <span className="history-modal-metric-label">Аргументы</span>
              </article>
              <article className="history-modal-metric-card">
                <span className="history-modal-metric-value">
                  {activeMatch.review?.pressure ?? 0}/10
                </span>
                <span className="history-modal-metric-label">Давление</span>
              </article>
            </div>

            <section className="history-modal-section">
              <h4 className="history-modal-section-title good">Что сработало</h4>
              <p className="history-modal-section-text good-bg">
                {activeMatch.review?.whatWorked || "Разбор пока не готов."}
              </p>
            </section>

            <section className="history-modal-section">
              <h4 className="history-modal-section-title bad">Что можно лучше</h4>
              {isPremium ? (
                <p className="history-modal-section-text bad-bg">
                  {activeMatch.review?.whatToImprove || "Попробуй пройти интервью ещё раз."}
                </p>
              ) : (
                <div className="review-locked-block bad-bg">
                  <p className="review-locked-title">Доступно в Pro</p>
                  <p className="review-locked-text">
                    Подключи Pro, чтобы увидеть персональные рекомендации по улучшению.
                  </p>
                </div>
              )}
            </section>

            <section className="history-modal-section">
              <h4 className="history-modal-section-title neutral">Лучший ответ</h4>
              {isPremium ? (
                <p className="history-modal-section-text neutral-bg best-answer">
                  {activeMatch.review?.bestAnswer || "Лучший ответ пока недоступен."}
                </p>
              ) : (
                <div className="review-locked-block neutral-bg">
                  <p className="review-locked-title">Доступно в Pro</p>
                  <p className="review-locked-text">
                    Подключи Pro, чтобы получить лучший вариант ответа на слабый момент интервью.
                  </p>
                </div>
              )}
            </section>

            <button className="history-modal-close-btn" onClick={openReadOnlyChat}>
              Посмотреть чат
            </button>

            <button className="history-modal-secondary-btn" onClick={() => setActiveMatch(null)}>
              Закрыть
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}

export default History;

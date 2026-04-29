import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "../components/BottomSheet";
import { getInterviewStats } from "../lib/interviews";
import Paywall from "../components/Paywall";
import { useAuth } from "../context/AuthContext";

const LEVELS = [
  { id: "junior", label: "Джуниор", replyLimit: 20 },
  { id: "middle", label: "Мидл", replyLimit: 15 },
  { id: "senior", label: "Сеньор", replyLimit: 10 },
];

const LEVEL_DESCRIPTIONS = {
  junior: "Джуниор: Легкий уровень. Больше поддержки и базовые вопросы.",
  middle: "Мидл: Средний уровень. Умеренное давление и акцент на опыте.",
  senior: "Сеньор: Хард уровень. Жестче вопросы и фокус на результатах.",
};
const FREE_DAILY_LIMIT = 1;
const PRO_DAILY_LIMIT = 10;

function Home() {
  const navigate = useNavigate();
  const { isPremium, interviewsToday, telegramId, refreshInterviewsToday } = useAuth();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPaywallOpen, setPaywallOpen] = useState(false);
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(LEVELS[1]);
  const [stats, setStats] = useState(() => getInterviewStats());

  const canStart = position.trim() && company.trim();
  const hasStats = stats.totalInterviews > 0;
  const statusText = useMemo(
    () => LEVEL_DESCRIPTIONS[selectedLevel.id],
    [selectedLevel.id]
  );

  const openSetup = async () => {
    const freshCount = await refreshInterviewsToday(telegramId);
    const effectiveCount = typeof freshCount === "number" ? freshCount : interviewsToday;
    const dailyLimit = isPremium ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

    if (effectiveCount >= dailyLimit) {
      setPaywallOpen(true);
      return;
    }
    setSheetOpen(true);
  };

  const startInterview = async () => {
    if (!canStart) return;

    const freshCount = await refreshInterviewsToday(telegramId);
    const effectiveCount = typeof freshCount === "number" ? freshCount : interviewsToday;
    const dailyLimit = isPremium ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    if (effectiveCount >= dailyLimit) {
      setSheetOpen(false);
      setPaywallOpen(true);
      return;
    }

    const interviewConfig = {
      position: position.trim(),
      company: company.trim(),
      level: selectedLevel.id,
      replyLimit: selectedLevel.replyLimit,
    };

    navigate("/chat", { state: interviewConfig });
  };

  useEffect(() => {
    const refreshStats = () => setStats(getInterviewStats());
    window.addEventListener("focus", refreshStats);
    refreshStats();
    return () => window.removeEventListener("focus", refreshStats);
  }, []);

  useEffect(() => {
    refreshInterviewsToday(telegramId);
  }, [telegramId, refreshInterviewsToday]);

  return (
    <section className="home-screen">
      <div className="home-mascot" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="14" cy="14" r="7" fill="#FAD7BE" />
          <circle cx="29" cy="14" r="7" fill="var(--color-accent)" />
          <rect x="6" y="25" width="18" height="10" rx="5" fill="#FAD7BE" />
          <rect x="18" y="25" width="20" height="10" rx="5" fill="var(--color-accent)" />
        </svg>
      </div>

      <h1 className="home-title">
        <span className="home-title-role">Role</span>
        <span className="home-title-cast">Cast</span>
      </h1>
      <p className="home-subtitle">
        Симулятор HR-интервью.
        <br />
        Докажи что ты достоин этой работы.
      </p>

      <button className="home-primary-btn" onClick={openSetup}>
        Начать интервью
      </button>

      {hasStats ? (
        <div className="home-stats">
          <div className="home-stat-item">
            <span className="home-stat-value">{stats.totalInterviews}</span>
            <span className="home-stat-label">Интервью</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat-item">
            <span className="home-stat-value">{stats.accepted}</span>
            <span className="home-stat-label">Оффер</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat-item">
            <span className="home-stat-value">{stats.winRate}</span>
            <span className="home-stat-label">Винрейт</span>
          </div>
        </div>
      ) : (
        <div className="home-stats-empty">
          У тебя пока нет статистики.
          <br />
          Пройди первое интервью, чтобы она появилась.
        </div>
      )}

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Настройка интервью"
      >
        <div className="sheet-section">
          <label className="sheet-label" htmlFor="position">
            На какую должность?
          </label>
          <input
            id="position"
            className="sheet-input"
            placeholder="Например: Product Manager"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>

        <div className="sheet-section">
          <label className="sheet-label" htmlFor="company">
            Компания или сфера?
          </label>
          <input
            id="company"
            className="sheet-input"
            placeholder="Например: Яндекс или IT в целом"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>

        <div className="sheet-section">
          <span className="sheet-label">Уровень кандидата</span>
          <div className="sheet-levels">
            {LEVELS.map((level) => (
              (() => {
                const isLocked = level.id === "senior" && !isPremium;
                return (
                  <button
                    key={level.id}
                    type="button"
                    className={`sheet-level-chip ${
                      selectedLevel.id === level.id ? "active" : ""
                    } ${isLocked ? "locked" : ""}`.trim()}
                    onClick={() => {
                      if (isLocked) {
                        setSheetOpen(false);
                        setPaywallOpen(true);
                        return;
                      }
                      setSelectedLevel(level);
                    }}
                    aria-disabled={isLocked}
                  >
                    <span>{level.label}</span>
                    {isLocked && (
                      <span className="sheet-chip-lock" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M8 10V7.5C8 5.57 9.57 4 11.5 4C13.43 4 15 5.57 15 7.5V10"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          <rect
                            x="6"
                            y="10"
                            width="11"
                            height="9"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })()
            ))}
          </div>
          <p className="sheet-help">{statusText}</p>
        </div>

        <button
          type="button"
          className={`sheet-submit-btn ${canStart ? "" : "disabled"}`.trim()}
          disabled={!canStart}
          onClick={startInterview}
        >
          Начать интервью
        </button>
      </BottomSheet>
      <Paywall isOpen={isPaywallOpen} onClose={() => setPaywallOpen(false)} />
    </section>
  );
}

export default Home;

import { useAuth } from "../context/AuthContext";
import { startStarsCheckout } from "../lib/billing";
import { useState } from "react";

const FEATURES = [
  "Старт: 10 интервью за 500 ⭐",
  "Прокачка: 30 интервью за 1299 ⭐",
  "Без автопродления",
];

function Subscription() {
  const { interviewAccess, refreshPremiumStatus, refreshInterviewAccess, telegramId } = useAuth();
  const [isPaying, setIsPaying] = useState(false);

  const handleBuyPackage = async (packageId) => {
    if (isPaying) return;
    setIsPaying(true);
    try {
      await startStarsCheckout({
        packageId,
        onPaid: async () => {
          await refreshPremiumStatus(telegramId);
          await refreshInterviewAccess(telegramId);
        },
        onClosed: () => {
          setIsPaying(false);
        },
      });
    } catch (error) {
      console.error("Failed to open Stars checkout", error);
      setIsPaying(false);
    }
  };

  return (
    <section className="subscription-screen">
      <h1 className="subscription-title">Пакеты интервью</h1>

      <article className="subscription-active-card">
        <p className="subscription-active-badge">Текущий баланс</p>
        <h2 className="subscription-active-name">{interviewAccess.remainingInterviews} интервью осталось</h2>
        <p className="subscription-active-date">
          Использовано: {interviewAccess.usedInterviews} из {interviewAccess.totalAllowed}
        </p>
      </article>

      <article className="subscription-inactive-card">
        <section className="subscription-inactive-head">
          <h2 className="subscription-inactive-title">Выбери пакет</h2>
          <p className="subscription-inactive-subtitle">
            Бесплатно доступно 2 интервью на аккаунт.
          </p>
        </section>

        <ul className="subscription-features in-card">
          {FEATURES.map((feature) => (
            <li key={feature} className="subscription-feature-item modern">
              <span className="subscription-feature-dot modern" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          className="subscription-buy-btn"
          onClick={() => handleBuyPackage("start")}
          disabled={isPaying}
        >
          {isPaying ? "Открываем оплату..." : "Купить Старт · 500 ⭐"}
        </button>
        <button
          className="subscription-cancel-btn"
          onClick={() => handleBuyPackage("boost")}
          disabled={isPaying}
        >
          {isPaying ? "Открываем оплату..." : "Купить Прокачка · 1299 ⭐"}
        </button>
        <p className="subscription-payment-note">Без автопродления</p>
      </article>

    </section>
  );
}

export default Subscription;

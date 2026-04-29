import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { startStarsCheckout } from "../lib/billing";

const PACKAGES = [
  { id: "start", title: "Старт", interviews: 10, stars: 500 },
  { id: "boost", title: "Прокачка", interviews: 30, stars: 1299, featured: true },
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
      <h1 className="subscription-title">Баланс</h1>

      <article className="subscription-active-card">
        <p className="subscription-active-badge">Текущий баланс</p>
        <h2 className="subscription-active-name">{interviewAccess.remainingInterviews} интервью</h2>
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

        <div className="package-grid">
          {PACKAGES.map((pkg) => (
            <article
              key={pkg.id}
              className={`package-card ${pkg.featured ? "featured" : ""}`.trim()}
            >
              <p className="package-card-title">{pkg.title}</p>
              <p className="package-card-meta">{pkg.interviews} интервью</p>
              <p className="package-card-price">{pkg.stars} ⭐</p>
              <button
                className="package-buy-btn"
                onClick={() => handleBuyPackage(pkg.id)}
                disabled={isPaying}
              >
                {isPaying ? "Открываем оплату..." : "Купить"}
              </button>
            </article>
          ))}
        </div>
      </article>

    </section>
  );
}

export default Subscription;

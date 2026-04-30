import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { startStarsCheckout } from "../lib/billing";

const PACKAGES = [
  { id: "warmup", title: "Разминка", interviews: 3, stars: 100 },
  { id: "battle", title: "Боевой режим", interviews: 10, stars: 300, featured: true },
  { id: "boost", title: "Прокачка", interviews: 25, stars: 600 },
];
const PAYMENT_REFRESH_RETRIES = 6;
const PAYMENT_REFRESH_DELAY_MS = 700;

function Subscription() {
  const { interviewAccess, refreshPremiumStatus, refreshInterviewAccess, telegramId } = useAuth();
  const [isPaying, setIsPaying] = useState(false);
  const [activePackageId, setActivePackageId] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const refreshBalanceAfterPayment = async (beforeRemaining) => {
    await refreshPremiumStatus(telegramId);
    for (let attempt = 0; attempt < PAYMENT_REFRESH_RETRIES; attempt += 1) {
      const access = await refreshInterviewAccess(telegramId);
      const nextRemaining =
        typeof access?.remainingInterviews === "number"
          ? access.remainingInterviews
          : interviewAccess.remainingInterviews;
      if (nextRemaining > beforeRemaining) return;
      await new Promise((resolve) => window.setTimeout(resolve, PAYMENT_REFRESH_DELAY_MS));
    }
  };

  const handleBuyPackage = async (packageId) => {
    if (isPaying) return;
    setPaymentError("");
    setIsPaying(true);
    setActivePackageId(packageId);
    const beforeRemaining = Number(interviewAccess.remainingInterviews || 0);
    try {
      await startStarsCheckout({
        packageId,
        onPaid: async () => {
          await refreshBalanceAfterPayment(beforeRemaining);
        },
        onClosed: () => {
          setIsPaying(false);
          setActivePackageId("");
        },
      });
    } catch (error) {
      console.error("Failed to open Stars checkout", error);
      setPaymentError(error instanceof Error ? error.message : "Не удалось открыть оплату.");
      setIsPaying(false);
      setActivePackageId("");
    }
  };

  return (
    <section className="subscription-screen">
      <h1 className="subscription-title">Баланс</h1>

      <article className="subscription-active-card">
        <p className="subscription-active-badge">Текущий баланс</p>
        <h2 className="subscription-active-name">{interviewAccess.remainingInterviews} интервью</h2>
      </article>

      <article className="subscription-inactive-card">
        <section className="subscription-inactive-head">
          <h2 className="subscription-inactive-title">Выбери пакет</h2>
          <p className="subscription-inactive-subtitle">
            Бесплатно доступно 1 интервью на аккаунт.
          </p>
        </section>

        <div className="package-grid">
          {PACKAGES.map((pkg) => (
            <article
              key={pkg.id}
              className={`package-card ${pkg.featured ? "featured" : ""}`.trim()}
            >
              <div className="package-card-row">
                <div className="package-card-main">
                  <p className="package-card-title">{pkg.title}</p>
                  <p className="package-card-meta">{pkg.interviews} интервью</p>
                </div>
                <button
                  className="package-buy-btn"
                  onClick={() => handleBuyPackage(pkg.id)}
                  disabled={isPaying}
                >
                  {isPaying && activePackageId === pkg.id
                    ? "Оплата..."
                    : `Купить за ${pkg.stars} ⭐`}
                </button>
              </div>
            </article>
          ))}
        </div>
        {paymentError && <p className="subscription-payment-note">{paymentError}</p>}
      </article>

    </section>
  );
}

export default Subscription;

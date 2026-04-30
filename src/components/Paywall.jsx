import Modal from "./Modal";
import { useState } from "react";
import { startStarsCheckout } from "../lib/billing";
import { useAuth } from "../context/AuthContext";

const PACKAGES = [
  { id: "warmup", title: "Разминка", interviews: 3, stars: 100 },
  { id: "battle", title: "Боевой режим", interviews: 10, stars: 300, featured: true },
  { id: "boost", title: "Прокачка", interviews: 25, stars: 600 },
];
const PAYMENT_REFRESH_RETRIES = 6;
const PAYMENT_REFRESH_DELAY_MS = 700;

function Paywall({ isOpen, onClose }) {
  const { refreshPremiumStatus, refreshInterviewAccess, interviewAccess, telegramId } = useAuth();
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
        onClosed: async (status) => {
          if (status === "paid") {
            onClose?.();
          }
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
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlay={false}>
      <div className="paywall-wrap">
        <div className="paywall-modal">
          <div className="paywall-star-wrap">
            <svg className="paywall-star" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2.6L14.82 8.31L21.12 9.22L16.56 13.67L17.63 19.96L12 17L6.37 19.96L7.44 13.67L2.88 9.22L9.18 8.31L12 2.6Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h3 className="paywall-title">Получи полный доступ</h3>
          <p className="paywall-subtitle">
            Бесплатно доступно только 1 интервью. Дальше выбери пакет:
          </p>

          <p className="paywall-balance-note">Сейчас доступно: {interviewAccess.remainingInterviews} интервью</p>

          <div className="package-grid paywall-package-grid">
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
          {paymentError && <p className="paywall-balance-note">{paymentError}</p>}
        </div>
        <button className="paywall-dismiss-btn" onClick={onClose}>
          Не сейчас
        </button>
      </div>
    </Modal>
  );
}

export default Paywall;

import Modal from "./Modal";
import { useState } from "react";
import { startStarsCheckout } from "../lib/billing";
import { useAuth } from "../context/AuthContext";

function Paywall({ isOpen, onClose }) {
  const { refreshPremiumStatus, telegramId } = useAuth();
  const [isPaying, setIsPaying] = useState(false);

  const handleSubscribe = async () => {
    if (isPaying) return;
    setIsPaying(true);
    try {
      await startStarsCheckout({
        onPaid: async () => {
          await refreshPremiumStatus(telegramId);
        },
        onClosed: async (status) => {
          if (status === "paid") {
            onClose?.();
          }
          setIsPaying(false);
        },
      });
    } catch (error) {
      console.error("Failed to open Stars checkout", error);
      setIsPaying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlay={false}>
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
        <p className="paywall-subtitle">Убирает все ограничения</p>

        <ul className="paywall-features">
          <li>10 интервью в день вместо одного</li>
          <li>Все уровни сложности</li>
          <li>Полный разбор каждого интервью</li>
        </ul>

        <div className="paywall-price-wrap">
          <p className="paywall-price">
            ⭐ 250 <span className="paywall-price-period">/ месяц</span>
          </p>
        </div>

        <button className="paywall-primary-btn" onClick={handleSubscribe} disabled={isPaying}>
          {isPaying ? "Открываем оплату..." : "Оформить подписку"}
        </button>
        <button className="paywall-secondary-btn" onClick={onClose}>
          Не сейчас
        </button>
      </div>
    </Modal>
  );
}

export default Paywall;

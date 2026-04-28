import { useAuth } from "../context/AuthContext";

const FEATURES = [
  "15 интервью в день",
  "Все уровни сложности",
  "Детальный разбор каждого интервью",
];

function Subscription() {
  const { isPremium } = useAuth();
  const isActiveSubscription = isPremium;

  return (
    <section className="subscription-screen">
      <h1 className="subscription-title">Подписка</h1>

      {isActiveSubscription ? (
        <>
          <article className="subscription-active-card">
            <p className="subscription-active-badge">Активна</p>
            <h2 className="subscription-active-name">Pro · 250₽ / мес</h2>
            <p className="subscription-active-date">Продлевается 14 июня 2026</p>
            <ul className="subscription-features in-card">
              {FEATURES.map((feature) => (
                <li key={feature} className="subscription-feature-item modern">
                  <span className="subscription-feature-dot modern" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </article>

          <button className="subscription-cancel-btn">Отменить продление</button>
        </>
      ) : null}

      {!isActiveSubscription && (
        <article className="subscription-inactive-card">
          <section className="subscription-inactive-head">
            <h2 className="subscription-inactive-title">Получи полный доступ</h2>
            <p className="subscription-inactive-subtitle">
              Сейчас у тебя 1 бесплатное интервью в день.
              <br />
              Оформи подписку, чтобы снять ограничения.
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

          <article className="subscription-price-card in-card">
            <p className="subscription-price-badge">Pro тариф</p>
            <p className="subscription-price-value">
              250₽ <span className="subscription-price-period">/ мес</span>
            </p>
          </article>

          <button className="subscription-buy-btn">Оформить подписку</button>
          <p className="subscription-payment-note">Отмена в любой момент</p>
        </article>
      )}

    </section>
  );
}

export default Subscription;

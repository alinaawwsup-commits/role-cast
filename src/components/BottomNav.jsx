import { NavLink } from "react-router-dom";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="bottom-nav-icon" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4L20 10.5V19C20 19.6 19.6 20 19 20H5C4.4 20 4 19.6 4 19V10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20V13H14.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="bottom-nav-icon" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="8" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="16" r="1" fill="currentColor" />
      <path
        d="M12.5 8H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12.5 12H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12.5 16H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SubscriptionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="bottom-nav-icon" fill="none" aria-hidden="true">
      <path
        d="M12 2.25L15.09 8.51L22 9.52L16.5 14.39L18.18 22.25L12 18.43L5.82 22.25L7.5 14.39L2 9.52L8.91 8.51L12 2.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `bottom-nav-link ${isActive ? "active" : ""}`.trim()
        }
      >
        <HomeIcon />
        <span>Главная</span>
      </NavLink>
      <NavLink
        to="/history"
        className={({ isActive }) =>
          `bottom-nav-link ${isActive ? "active" : ""}`.trim()
        }
      >
        <HistoryIcon />
        <span>История</span>
      </NavLink>
      <NavLink
        to="/subscription"
        className={({ isActive }) =>
          `bottom-nav-link ${isActive ? "active" : ""}`.trim()
        }
      >
        <SubscriptionIcon />
        <span>Подписка</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Chat from "./screens/Chat";
import History from "./screens/History";
import Home from "./screens/Home";
import Subscription from "./screens/Subscription";

function App() {
  const location = useLocation();
  const showBottomNav = location.pathname !== "/chat";

  return (
    <div className="app-shell">
      <main className={`screen-container ${showBottomNav ? "with-nav" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<History />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}

export default App;

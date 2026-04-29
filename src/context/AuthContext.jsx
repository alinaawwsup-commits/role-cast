import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getInterviewsToday, getTelegramId, isPremiumUser } from "../lib/user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [telegramId, setTelegramId] = useState("test_user_123");
  const [isPremium, setIsPremium] = useState(false);
  const [interviewsToday, setInterviewsToday] = useState(0);
  const [isAuthLoading, setAuthLoading] = useState(true);

  const refreshInterviewsToday = async (idOverride) => {
    const effectiveId = idOverride || telegramId;
    if (!effectiveId) return null;
    try {
      const nextCount = await getInterviewsToday(effectiveId);
      setInterviewsToday(nextCount);
      return nextCount;
    } catch (error) {
      console.error("Failed to refresh interviewsToday", error);
      return null;
    }
  };

  const refreshPremiumStatus = async (idOverride) => {
    const effectiveId = idOverride || telegramId;
    if (!effectiveId) return null;
    try {
      const nextPremium = await isPremiumUser(effectiveId);
      setIsPremium(nextPremium);
      return nextPremium;
    } catch (error) {
      console.error("Failed to refresh premium status", error);
      return null;
    }
  };

  useEffect(() => {
    const load = async () => {
      setAuthLoading(true);
      try {
        const nextTelegramId = getTelegramId();
        setTelegramId(nextTelegramId);
        const [premium, todayCount] = await Promise.all([
          isPremiumUser(nextTelegramId),
          getInterviewsToday(nextTelegramId),
        ]);
        setIsPremium(premium);
        setInterviewsToday(todayCount);
      } catch (error) {
        console.error("Failed to initialize auth context", error);
      } finally {
        setAuthLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      refreshPremiumStatus();
      refreshInterviewsToday();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [telegramId]);

  const value = useMemo(
    () => ({
      telegramId,
      isPremium,
      interviewsToday,
      isAuthLoading,
      refreshInterviewsToday,
      refreshPremiumStatus,
    }),
    [telegramId, isPremium, interviewsToday, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

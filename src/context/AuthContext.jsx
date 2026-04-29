import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getInterviewAccess, getTelegramId, isPremiumUser } from "../lib/user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [telegramId, setTelegramId] = useState("test_user_123");
  const [isPremium, setIsPremium] = useState(false);
  const [interviewAccess, setInterviewAccess] = useState({
    freeIncluded: 2,
    purchasedCredits: 0,
    usedInterviews: 0,
    totalAllowed: 2,
    remainingInterviews: 2,
  });
  const [isAuthLoading, setAuthLoading] = useState(true);

  const refreshInterviewAccess = async (idOverride) => {
    const effectiveId = idOverride || telegramId;
    if (!effectiveId) return null;
    try {
      const nextAccess = await getInterviewAccess(effectiveId);
      setInterviewAccess(nextAccess);
      return nextAccess;
    } catch (error) {
      console.error("Failed to refresh interview access", error);
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
        const [premium, nextAccess] = await Promise.all([
          isPremiumUser(nextTelegramId),
          getInterviewAccess(nextTelegramId),
        ]);
        setIsPremium(premium);
        setInterviewAccess(nextAccess);
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
      refreshInterviewAccess();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [telegramId]);

  const value = useMemo(
    () => ({
      telegramId,
      isPremium,
      interviewAccess,
      isAuthLoading,
      refreshInterviewAccess,
      refreshPremiumStatus,
    }),
    [telegramId, isPremium, interviewAccess, isAuthLoading]
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

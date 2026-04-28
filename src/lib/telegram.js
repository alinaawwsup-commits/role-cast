import WebApp from "@twa-dev/sdk";

export function initTelegramApp() {
  try {
    WebApp.ready();
    WebApp.expand();
    try {
      WebApp.setBackgroundColor("#fafaf8");
      WebApp.setHeaderColor("#fafaf8");
    } catch {
      // Some clients may not support color methods.
    }
  } catch (error) {
    console.warn("Telegram WebApp is not available outside Telegram.", error);
  }
}

import WebApp from "@twa-dev/sdk";

function applyTelegramTheme() {
  const { themeParams } = WebApp;

  if (!themeParams) return;

  const root = document.documentElement;

  if (themeParams.bg_color) {
    root.style.setProperty("--color-bg", themeParams.bg_color);
  }
  if (themeParams.secondary_bg_color) {
    root.style.setProperty("--color-surface", themeParams.secondary_bg_color);
  }
  if (themeParams.button_color) {
    root.style.setProperty("--color-accent", themeParams.button_color);
  }
  if (themeParams.text_color) {
    root.style.setProperty("--color-text", themeParams.text_color);
  }
  if (themeParams.hint_color) {
    root.style.setProperty("--color-muted", themeParams.hint_color);
  }
  if (themeParams.section_separator_color) {
    root.style.setProperty("--color-border", themeParams.section_separator_color);
  }
}

export function initTelegramApp() {
  try {
    WebApp.ready();
    WebApp.expand();
    applyTelegramTheme();
  } catch (error) {
    console.warn("Telegram WebApp is not available outside Telegram.", error);
  }
}

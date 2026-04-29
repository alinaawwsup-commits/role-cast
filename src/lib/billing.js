import WebApp from "@twa-dev/sdk";
import { getTelegramId } from "./user";

async function createStarsInvoice(packageId) {
  const response = await fetch("/api/stars/create-invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      telegramId: getTelegramId(),
      packageId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Не удалось создать счет: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.invoiceLink) {
    throw new Error("Сервер не вернул ссылку на оплату.");
  }

  return payload.invoiceLink;
}

export async function startStarsCheckout({ packageId, onPaid, onClosed } = {}) {
  const invoiceLink = await createStarsInvoice(packageId);

  if (typeof WebApp?.openInvoice === "function") {
    let callbackCalled = false;
    const timeoutId = window.setTimeout(() => {
      if (!callbackCalled) {
        onClosed?.("timeout");
      }
    }, 12000);

    const handleStatus = (status) => {
      callbackCalled = true;
      window.clearTimeout(timeoutId);
      if (status === "paid") {
        onPaid?.();
      }
      onClosed?.(status);
    };

    try {
      // Telegram expects a full t.me invoice URL.
      WebApp.openInvoice(invoiceLink, handleStatus);
    } catch (primaryError) {
      try {
        // Fallback for clients that accept the short invoice slug.
        const slug = String(invoiceLink).replace(/^https?:\/\/t\.me\//i, "");
        WebApp.openInvoice(slug, handleStatus);
      } catch {
        window.clearTimeout(timeoutId);
        throw primaryError;
      }
    }
    return;
  }

  window.open(invoiceLink, "_blank", "noopener,noreferrer");
  onClosed?.("opened");
}

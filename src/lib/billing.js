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
    let retryTimerId = 0;
    const statusTimeoutId = window.setTimeout(() => {
      if (!callbackCalled) {
        callbackCalled = true;
        window.clearTimeout(retryTimerId);
        onClosed?.("timeout");
      }
    }, 15000);

    const handleStatus = (status) => {
      if (callbackCalled) return;
      callbackCalled = true;
      window.clearTimeout(retryTimerId);
      window.clearTimeout(statusTimeoutId);
      if (status === "paid") {
        onPaid?.();
      }
      onClosed?.(status);
    };

    const urlValue = String(invoiceLink).trim();
    const slugValue = urlValue.replace(/^https?:\/\/t\.me\//i, "");
    const candidates = [slugValue, urlValue];

    let attemptIndex = 0;
    const tryOpen = () => {
      if (callbackCalled || attemptIndex >= candidates.length) return;
      const value = candidates[attemptIndex];
      attemptIndex += 1;
      try {
        WebApp.openInvoice(value, handleStatus);
      } catch (openError) {
        if (attemptIndex >= candidates.length) {
          window.clearTimeout(statusTimeoutId);
          throw openError;
        }
        tryOpen();
      }
    };

    tryOpen();

    retryTimerId = window.setTimeout(() => {
      if (!callbackCalled && attemptIndex < candidates.length) {
        tryOpen();
      }
    }, 2500);
    return;
  }

  window.open(invoiceLink, "_blank", "noopener,noreferrer");
  onClosed?.("opened");
}

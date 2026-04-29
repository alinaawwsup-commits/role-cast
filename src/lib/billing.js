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

function toTelegramInvoiceParam(invoiceLink) {
  if (typeof invoiceLink !== "string") return invoiceLink;
  const trimmed = invoiceLink.trim();
  const match = trimmed.match(/^https?:\/\/t\.me\/(.+)$/i);
  return match ? match[1] : trimmed;
}

export async function startStarsCheckout({ packageId, onPaid, onClosed } = {}) {
  const invoiceLink = await createStarsInvoice(packageId);

  if (typeof WebApp?.openInvoice === "function") {
    const invoiceParam = toTelegramInvoiceParam(invoiceLink);
    let callbackCalled = false;
    const timeoutId = window.setTimeout(() => {
      if (!callbackCalled) {
        onClosed?.("timeout");
      }
    }, 12000);

    WebApp.openInvoice(invoiceParam, (status) => {
      callbackCalled = true;
      window.clearTimeout(timeoutId);
      if (status === "paid") {
        onPaid?.();
      }
      onClosed?.(status);
    });
    return;
  }

  window.open(invoiceLink, "_blank", "noopener,noreferrer");
  onClosed?.("opened");
}

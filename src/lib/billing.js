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
    WebApp.openInvoice(invoiceLink, (status) => {
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

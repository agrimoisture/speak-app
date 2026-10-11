export function micErrorMessage(error) {
  const name = error?.name || "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "麥克風權限被拒絕。請到 iPhone 的「設定 › Safari › 麥克風」，或瀏覽器網址列的權限，允許本站使用麥克風，然後再按一次開始。";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "找不到可用的麥克風。請確認這台裝置有麥克風，而且沒有在系統裡被關閉。";
    case "NotReadableError":
    case "TrackStartError":
      return "麥克風目前無法啟動，可能正被其他 App 使用。請關閉其他正在錄音的程式後再試。";
    case "SecurityError":
      return "瀏覽器因安全性限制無法使用麥克風。請用 HTTPS 開啟本站；在自己的電腦上則可以用 localhost。";
    case "OverconstrainedError":
      return "這台裝置無法套用麥克風設定。請改用系統預設麥克風，或換一台裝置再試。";
    case "AbortError":
      return "麥克風啟動被中斷。請再按一次開始。";
    default:
      return "無法使用麥克風。請允許權限，並用 iOS Safari 或 Chrome 開啟這個頁面。";
  }
}

export function insecureContextMessage(isSecure) {
  if (isSecure) return "";
  return "麥克風需要安全連線。請用 https 開啟；在電腦上測試時可用 localhost。";
}

export function apiErrorMessage(status, bodyText = "") {
  const detail = summarizeApiBody(bodyText);
  if (status === 400) {
    return `連線被拒絕（400）。請確認金鑰有效，而且這個專案可以呼叫 Gemini。${detail}`;
  }
  if (status === 401 || status === 403) {
    return `金鑰無效、已停用，或沒有權限（${status}）。請到 Google AI Studio 檢查金鑰。${detail}`;
  }
  if (status === 429) {
    return "已達到速率或免費額度上限（429）。請稍後再試。官方文件沒有公布固定的免費層每分鐘次數，實際額度以 AI Studio 顯示的為準。";
  }
  if (status >= 500) {
    return `Gemini 服務暫時沒有回應（${status}）。請稍後再試。`;
  }
  if (status) return `連線失敗（${status}）。${detail}`.trim();
  return detail || "連線失敗。請檢查網路後再試。";
}

export function socketCloseMessage(code, reason = "") {
  const clean = String(reason || "").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 180);
  if (code === 1008) {
    return `連線被伺服器拒絕。請檢查 API 金鑰與額度。${clean ? `（${clean}）` : ""}`;
  }
  if (code === 1006) return "連線中斷。若對話已開始，可以按結束取得目前的回饋。";
  if (code === 1011) return "Gemini 伺服器發生錯誤。請稍後再開始一次。";
  if (clean) return `連線已關閉（${code}）：${clean}`;
  return `連線已關閉（${code || "未知"}）。`;
}

function summarizeApiBody(bodyText) {
  if (!bodyText) return "";
  try {
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message || parsed?.message || "";
    if (!message) return "";
    return ` ${String(message).replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 180)}`;
  } catch {
    return "";
  }
}

export function redactSecrets(text, apiKey = "") {
  let out = String(text || "");
  if (apiKey) out = out.split(apiKey).join("[key]");
  return out.replace(/key=[^&\s]+/gi, "key=[redacted]");
}

import { useEffect, useState } from "react";
import Turnstile from "react-turnstile";

export default function TurnstileWidget({ siteKey, onToken, resetSignal = 0 }) {
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    if (resetSignal > 0) {
      setWidgetKey((previous) => previous + 1);
    }
  }, [resetSignal]);

  if (!siteKey) {
    return <p className="captcha-message">El captcha no está configurado.</p>;
  }

  return (
    <div className="captcha">
      <Turnstile
        key={widgetKey}
        sitekey={siteKey}
        onVerify={(token) => onToken(token)}
        onExpire={() => onToken("")}
        onError={() => onToken("")}
      />
    </div>
  );
}

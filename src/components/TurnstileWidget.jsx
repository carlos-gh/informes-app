import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const loadTurnstileScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    if (document.getElementById(SCRIPT_ID)) {
      if (window.turnstile) {
        resolve();
        return;
      }

      document.getElementById(SCRIPT_ID).addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });
};

export default function TurnstileWidget({ siteKey, onToken, resetSignal = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isActive = true;

    if (!siteKey || !containerRef.current) {
      return () => {};
    }

    loadTurnstileScript()
      .then(() => {
        if (!isActive || !window.turnstile || !containerRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => {
        if (isActive) {
          setLoadError("No se pudo cargar el captcha.");
        }
      });

    return () => {
      isActive = false;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onToken]);

  useEffect(() => {
    if (!window.turnstile || widgetIdRef.current === null) {
      return;
    }

    if (resetSignal > 0) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!siteKey) {
    return <p className="captcha-message">El captcha no está configurado.</p>;
  }

  if (loadError) {
    return <p className="captcha-message">{loadError}</p>;
  }

  return <div className="captcha" ref={containerRef} />;
}

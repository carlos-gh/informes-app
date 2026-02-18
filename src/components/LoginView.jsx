import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import TurnstileWidget from "./TurnstileWidget.jsx";

export default function LoginView({ onLogin }) {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetCounter, setResetCounter] = useState(0);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  const updateCredentials = (field, value) => {
    setCredentials((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleToken = useCallback((token) => {
    setTurnstileToken(token);
  }, []);

  const resetCaptcha = () => {
    setResetCounter((previous) => previous + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (credentials.username.trim() === "" || credentials.password.trim() === "") {
      setSubmitStatus("error");
      setSubmitMessage("Ingrese usuario y contraseña.");
      return;
    }

    if (!siteKey) {
      setSubmitStatus("error");
      setSubmitMessage("El captcha no está configurado.");
      return;
    }

    if (!turnstileToken) {
      setSubmitStatus("error");
      setSubmitMessage("Confirme el captcha para continuar.");
      resetCaptcha();
      return;
    }

    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password,
          turnstileToken,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Demasiados intentos. Inténtelo nuevamente más tarde.");
        }

        throw new Error("Login failed");
      }

      const data = await response.json();

      if (!data?.user) {
        throw new Error("Missing token");
      }

      onLogin({ user: data.user || null });
      setSubmitStatus("success");
      navigate("/admin");
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        String(error.message || "Las credenciales no son válidas.")
      );
      setTurnstileToken("");
      resetCaptcha();
    }
  };

  return (
    <section>
      <h1 className="title">Iniciar sesión</h1>
      <p className="subtitle">Use sus credenciales para acceder al panel.</p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">
            Usuario <span className="required">*</span>
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={credentials.username}
            onChange={(event) => updateCredentials("username", event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">
            Contraseña <span className="required">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) => updateCredentials("password", event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Verificación</label>
          <TurnstileWidget
            siteKey={siteKey}
            onToken={handleToken}
            resetSignal={resetCounter}
          />
        </div>

        <button className="submit" type="submit" disabled={submitStatus === "loading"}>
          {submitStatus === "loading" ? "Ingresando..." : "Entrar"}
        </button>

        {submitMessage ? (
          <div className="feedback error" role="status">
            {submitMessage}
          </div>
        ) : null}
      </form>
    </section>
  );
}

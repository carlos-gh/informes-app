import { useState } from "react";
import { Link } from "react-router-dom";

export default function ProfileView({ authToken, onLogout }) {
  const isAuthenticated = Boolean(authToken);
  const [formState, setFormState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [formError, setFormError] = useState("");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const updateForm = (field, value) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formState.currentPassword || !formState.newPassword || !formState.confirmPassword) {
      return "Todos los campos son obligatorios.";
    }

    if (formState.newPassword.length < 10) {
      return "La nueva contraseña debe tener al menos 10 caracteres.";
    }

    if (formState.newPassword !== formState.confirmPassword) {
      return "La confirmación de contraseña no coincide.";
    }

    if (formState.currentPassword === formState.newPassword) {
      return "La nueva contraseña debe ser diferente a la actual.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    const errorMessage = validateForm();

    if (errorMessage) {
      setFormError(errorMessage);
      setSubmitStatus("error");
      return;
    }

    setFormError("");
    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword: formState.currentPassword,
          newPassword: formState.newPassword,
        }),
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(String(data?.error || "No se pudo cambiar la contraseña."));
      }

      setSubmitStatus("success");
      setSubmitMessage("Contraseña actualizada correctamente.");
      setFormState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo cambiar la contraseña."));
    }
  };

  if (!isAuthenticated) {
    return (
      <section>
        <h1 className="title">Acceso requerido</h1>
        <p className="subtitle">Debe iniciar sesión para ver su perfil.</p>
        <Link className="nav-link" to="/login">
          Ir al inicio de sesión
        </Link>
      </section>
    );
  }

  return (
    <section className="admin config">
      <div className="admin-header">
        <div>
          <p className="brand">Cuenta</p>
          <h1 className="title">Perfil</h1>
          <p className="subtitle">Cambie su contraseña de acceso.</p>
        </div>
      </div>

      <section className="config-theme">
        <h2 className="config-section-title">Seguridad</h2>
        <p className="config-section-description">
          Use una contraseña fuerte para proteger su cuenta.
        </p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="profile-current-password">
              Contraseña actual <span className="required">*</span>
            </label>
            <input
              id="profile-current-password"
              name="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={formState.currentPassword}
              onChange={(event) => updateForm("currentPassword", event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="profile-new-password">
              Nueva contraseña <span className="required">*</span>
            </label>
            <input
              id="profile-new-password"
              name="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={formState.newPassword}
              onChange={(event) => updateForm("newPassword", event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="profile-confirm-password">
              Confirmar contraseña <span className="required">*</span>
            </label>
            <input
              id="profile-confirm-password"
              name="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              value={formState.confirmPassword}
              onChange={(event) => updateForm("confirmPassword", event.target.value)}
              required
            />
          </div>

          {formError ? <p className="error">{formError}</p> : null}

          <div className="form-actions">
            <button className="submit" type="submit" disabled={submitStatus === "loading"}>
              {submitStatus === "loading" ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </div>

          {submitMessage ? (
            <div
              className={`feedback ${submitStatus === "success" ? "success" : "error"}`}
              role="status"
            >
              {submitMessage}
            </div>
          ) : null}
        </form>
      </section>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function ProfileView({
  authToken,
  onLogout,
  authUser = null,
  onProfileUserUpdate = () => {},
  theme = "dark",
  onThemeChange = () => {},
}) {
  const isAuthenticated = Boolean(authToken);
  const [nameFormState, setNameFormState] = useState({
    fullName: String(authUser?.fullName || ""),
  });
  const [nameFormError, setNameFormError] = useState("");
  const [nameSubmitStatus, setNameSubmitStatus] = useState("idle");
  const [nameSubmitMessage, setNameSubmitMessage] = useState("");
  const [formState, setFormState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [formError, setFormError] = useState("");
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [themeSubmitMessage, setThemeSubmitMessage] = useState("");

  useEffect(() => {
    setNameFormState({
      fullName: String(authUser?.fullName || ""),
    });
  }, [authUser?.fullName]);

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

  const validateNameForm = () => {
    const value = String(nameFormState.fullName || "")
      .replace(/\s+/g, " ")
      .trim();

    if (value.length < 2 || value.length > 100) {
      return "El nombre debe tener entre 2 y 100 caracteres.";
    }

    return "";
  };

  const handleNameSubmit = async (event) => {
    event.preventDefault();
    setNameSubmitMessage("");

    const errorMessage = validateNameForm();

    if (errorMessage) {
      setNameFormError(errorMessage);
      setNameSubmitStatus("error");
      return;
    }

    setNameFormError("");
    setNameSubmitStatus("loading");

    try {
      const response = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fullName: String(nameFormState.fullName || "").replace(/\s+/g, " ").trim(),
        }),
      });

      if (response.status === 401) {
        onLogout();
        setNameSubmitStatus("error");
        setNameSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(String(data?.error || "No se pudo guardar el perfil."));
      }

      const data = await response.json();
      onProfileUserUpdate(data?.user || null);
      setNameSubmitStatus("success");
      setNameSubmitMessage("Nombre actualizado correctamente.");
    } catch (error) {
      setNameSubmitStatus("error");
      setNameSubmitMessage(String(error.message || "No se pudo guardar el perfil."));
    }
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

  const handleThemeSelect = (event) => {
    const value = String(event.target.value || "");

    if (value !== "dark" && value !== "light") {
      return;
    }

    onThemeChange(value);
    setThemeSubmitMessage("Tema actualizado correctamente.");
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
        <h2 className="config-section-title">Datos de perfil</h2>
        <p className="config-section-description">
          Defina el nombre que se mostrará en su cuenta.
        </p>

        <form className="form" onSubmit={handleNameSubmit} noValidate>
          <div className="field">
            <label htmlFor="profile-full-name">
              Nombre de la persona <span className="required">*</span>
            </label>
            <input
              id="profile-full-name"
              name="profile-full-name"
              type="text"
              value={nameFormState.fullName}
              onChange={(event) =>
                setNameFormState({ fullName: event.target.value })
              }
              required
            />
          </div>

          {nameFormError ? <p className="error">{nameFormError}</p> : null}

          <div className="form-actions">
            <button className="submit" type="submit" disabled={nameSubmitStatus === "loading"}>
              {nameSubmitStatus === "loading" ? "Guardando..." : "Guardar nombre"}
            </button>
          </div>

          {nameSubmitMessage ? (
            <div
              className={`feedback ${nameSubmitStatus === "success" ? "success" : "error"}`}
              role="status"
            >
              {nameSubmitMessage}
            </div>
          ) : null}
        </form>
      </section>

      <section className="config-theme">
        <h2 className="config-section-title">Preferencias</h2>
        <p className="config-section-description">
          Personalice el tema visual de la aplicación.
        </p>

        <div className="field">
          <label htmlFor="profile-theme">Tema predeterminado</label>
          <select
            id="profile-theme"
            name="profile-theme"
            value={theme}
            onChange={handleThemeSelect}
          >
            <option value="dark">Oscuro (predeterminado)</option>
            <option value="light">Claro</option>
          </select>
        </div>

        {themeSubmitMessage ? (
          <div className="feedback success" role="status">
            {themeSubmitMessage}
          </div>
        ) : null}
      </section>

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

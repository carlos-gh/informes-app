import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";

const AUTH_TOKEN_KEY = "reports_admin_token";

// The report always targets the previous month relative to today.
const getReportDate = (currentDate) => {
  return new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
};

const getMonthNameInSpanish = (date) => {
  return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(date);
};

const getReportingLabel = (date) => {
  const monthName = getMonthNameInSpanish(date);
  const year = date.getFullYear();
  return `${monthName} ${year}`;
};

const getReportMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getReportDateFromKey = (monthKey) => {
  if (!monthKey) {
    return null;
  }

  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
};

const getReportingLabelFromKey = (monthKey) => {
  const date = getReportDateFromKey(monthKey);
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
    date
  );
};

const isFormWindowOpen = (currentDate) => {
  const dayOfMonth = currentDate.getDate();
  return dayOfMonth >= 1 && dayOfMonth <= 10;
};

const isNumericValue = (value) => {
  return value.trim() === "" || !Number.isNaN(Number(value));
};

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const buildDefaultAdminForm = (defaultMonthKey) => ({
  reportMonthKey: defaultMonthKey,
  name: "",
  participation: "",
  hours: "",
  courses: "",
  comments: "",
});

const getStoredToken = () => {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
};

const storeToken = (token) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

const clearToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

const ReportFormView = () => {
  const currentDate = useMemo(() => new Date(), []);
  const reportDate = useMemo(() => getReportDate(currentDate), [currentDate]);
  const reportMonthName = useMemo(
    () => getMonthNameInSpanish(reportDate),
    [reportDate]
  );
  const reportMonthLabel = useMemo(
    () => getReportingLabel(reportDate),
    [reportDate]
  );
  const reportMonthKey = useMemo(
    () => getReportMonthKey(reportDate),
    [reportDate]
  );

  const isOpen = useMemo(() => isFormWindowOpen(currentDate), [currentDate]);

  const [formData, setFormData] = useState({
    name: "",
    participation: "",
    hours: "",
    courses: "",
    comments: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const updateFormData = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleParticipationChange = (value) => {
    setFormData((previous) => ({
      ...previous,
      participation: value,
      hours: value === "Sí participé." ? previous.hours : "",
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (formData.name.trim().length === 0) {
      nextErrors.name = "El nombre es obligatorio.";
    }

    if (formData.participation.trim().length === 0) {
      nextErrors.participation = "Seleccione una opción de participación.";
    }

    if (!isNumericValue(formData.hours)) {
      nextErrors.hours = "Ingrese un número válido.";
    }

    if (!isNumericValue(formData.courses)) {
      nextErrors.courses = "Ingrese un número válido.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      participation: "",
      hours: "",
      courses: "",
      comments: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (!validateForm()) {
      setSubmitStatus("error");
      setSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    const payload = {
      reportMonthKey,
      reportMonthLabel,
      name: formData.name.trim(),
      participation: formData.participation,
      hours: formData.hours.trim(),
      courses: formData.courses.trim(),
      comments: formData.comments.trim(),
    };

    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      setSubmitStatus("success");
      setSubmitMessage("Su informe fue enviado correctamente.");
      resetForm();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        "No se pudo enviar el informe. Inténtelo de nuevo más tarde."
      );
    }
  };

  return (
    <section>
      <h1 className="title">Informe mensual de actividades</h1>

      {isOpen ? (
        <p className="subtitle">
          Ya puede enviar sus informes predicacion del mes de{" "}
          <span className="month-highlight">{reportMonthName}</span>
        </p>
      ) : (
        <div className="closed">
          <p className="closed-title">El periodo para enviar informes está cerrado.</p>
          <p className="closed-message">
            El formulario solo está disponible los primeros dias del mes. Regrese el
            proximo mes para enviar su informe. Si desea enviar un informe, contacte a
            su superintendente de grupo.
          </p>
        </div>
      )}

      {isOpen ? (
        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">
              Nombre <span className="required">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={(event) => updateFormData("name", event.target.value)}
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={formErrors.name ? "name-error" : undefined}
              required
            />
            {formErrors.name ? (
              <span id="name-error" className="error">
                {formErrors.name}
              </span>
            ) : null}
          </div>

          <fieldset className="field">
            <legend>
              Participación <span className="required">*</span>
            </legend>
            <div className="options">
              <label className="option">
                <input
                  type="radio"
                  name="participation"
                  value="Sí participé."
                  checked={formData.participation === "Sí participé."}
                  onChange={(event) => handleParticipationChange(event.target.value)}
                  required
                />
                Sí participé.
              </label>
              <label className="option">
                <input
                  type="radio"
                  name="participation"
                  value="No participé."
                  checked={formData.participation === "No participé."}
                  onChange={(event) => handleParticipationChange(event.target.value)}
                  required
                />
                No participé.
              </label>
            </div>
            {formErrors.participation ? (
              <span className="error">{formErrors.participation}</span>
            ) : null}
          </fieldset>

          <div className="field">
            <label htmlFor="hours">
              Horas (para precursores auxiliares y regulares)
            </label>
            <input
              id="hours"
              name="hours"
              type="number"
              min="0"
              inputMode="numeric"
              value={formData.hours}
              onChange={(event) => updateFormData("hours", event.target.value)}
              aria-invalid={Boolean(formErrors.hours)}
              aria-describedby={formErrors.hours ? "hours-error" : undefined}
              disabled={formData.participation !== "Sí participé."}
            />
            {formErrors.hours ? (
              <span id="hours-error" className="error">
                {formErrors.hours}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="courses">Número de diferentes cursos bíblicos dirigidos</label>
            <input
              id="courses"
              name="courses"
              type="number"
              min="0"
              inputMode="numeric"
              value={formData.courses}
              onChange={(event) => updateFormData("courses", event.target.value)}
              aria-invalid={Boolean(formErrors.courses)}
              aria-describedby={formErrors.courses ? "courses-error" : undefined}
            />
            {formErrors.courses ? (
              <span id="courses-error" className="error">
                {formErrors.courses}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="comments">Comentarios</label>
            <textarea
              id="comments"
              name="comments"
              rows="4"
              value={formData.comments}
              onChange={(event) => updateFormData("comments", event.target.value)}
            />
          </div>

          <button className="submit" type="submit" disabled={submitStatus === "loading"}>
            {submitStatus === "loading" ? "Enviando..." : "Enviar informe"}
          </button>

          {submitMessage ? (
            <div
              className={`feedback ${submitStatus === "success" ? "success" : "error"}`}
              role="status"
            >
              {submitMessage}
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="footer-row">
        <p className="footer-note">© Congregación El Puente Monte Tabor</p>
        <Link className="footer-link" to="/login">
          Acceso administrativo
        </Link>
      </div>
    </section>
  );
};

const LoginView = ({ onLogin }) => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const updateCredentials = (field, value) => {
    setCredentials((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (credentials.username.trim() === "" || credentials.password.trim() === "") {
      setSubmitStatus("error");
      setSubmitMessage("Ingrese usuario y contraseña.");
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
        }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("Missing token");
      }

      onLogin(data.token);
      setSubmitStatus("success");
      navigate("/admin");
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("Las credenciales no son válidas.");
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
};

const AdminView = ({ authToken, onLogout }) => {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const defaultMonthKey = useMemo(() => getReportMonthKey(getReportDate(new Date())), []);
  const [adminForm, setAdminForm] = useState(buildDefaultAdminForm(defaultMonthKey));
  const [formErrors, setFormErrors] = useState({});

  const isAuthenticated = Boolean(authToken);

  const monthOptions = useMemo(() => {
    const uniqueKeys = new Set([
      defaultMonthKey,
      ...reports.map((report) => report.reportMonthKey),
    ]);
    return Array.from(uniqueKeys)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (!selectedMonthKey) {
      return reports;
    }

    return reports.filter((report) => report.reportMonthKey === selectedMonthKey);
  }, [reports, selectedMonthKey]);

  const updateAdminForm = (field, value) => {
    setAdminForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetAdminForm = (monthKey) => {
    setAdminForm(buildDefaultAdminForm(monthKey));
    setEditingId(null);
    setFormErrors({});
  };

  const validateAdminForm = () => {
    const nextErrors = {};

    if (!adminForm.reportMonthKey || !getReportDateFromKey(adminForm.reportMonthKey)) {
      nextErrors.reportMonthKey = "Seleccione un mes válido.";
    }

    if (adminForm.name.trim().length === 0) {
      nextErrors.name = "El nombre es obligatorio.";
    }

    if (adminForm.participation.trim().length === 0) {
      nextErrors.participation = "Seleccione una opción de participación.";
    }

    if (!isNumericValue(adminForm.hours)) {
      nextErrors.hours = "Ingrese un número válido.";
    }

    if (!isNumericValue(adminForm.courses)) {
      nextErrors.courses = "Ingrese un número válido.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const loadReports = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/reports", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        setLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load reports");
      }

      const data = await response.json();
      setReports(data.items || []);
    } catch (error) {
      setLoadError("No se pudieron cargar los registros.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [authToken]);

  useEffect(() => {
    if (monthOptions.length > 0 && !selectedMonthKey) {
      setSelectedMonthKey(monthOptions[0]);
    }
  }, [monthOptions, selectedMonthKey]);

  const handleEdit = (report) => {
    setEditingId(report.id);
    setAdminForm({
      reportMonthKey: report.reportMonthKey || defaultMonthKey,
      name: report.name || "",
      participation: report.participation || "",
      hours: report.hours || "",
      courses: report.courses || "",
      comments: report.comments || "",
    });
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm("¿Desea eliminar este registro?")) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete report");
      }

      setSubmitStatus("success");
      setSubmitMessage("El registro fue eliminado.");
      await loadReports();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("No se pudo eliminar el registro.");
    }
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (!validateAdminForm()) {
      setSubmitStatus("error");
      setSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    setSubmitStatus("loading");

    const payload = {
      reportMonthKey: adminForm.reportMonthKey,
      name: adminForm.name.trim(),
      participation: adminForm.participation,
      hours: adminForm.hours.trim(),
      courses: adminForm.courses.trim(),
      comments: adminForm.comments.trim(),
    };

    try {
      const response = await fetch(editingId ? `/api/reports/${editingId}` : "/api/reports", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save report");
      }

      setSubmitStatus("success");
      setSubmitMessage(
        editingId ? "El registro fue actualizado." : "El registro fue agregado."
      );
      resetAdminForm(defaultMonthKey);
      await loadReports();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("No se pudo guardar el registro.");
    }
  };

  if (!isAuthenticated) {
    return (
      <section>
        <h1 className="title">Acceso requerido</h1>
        <p className="subtitle">Debe iniciar sesión para ver los registros.</p>
        <Link className="nav-link" to="/login">
          Ir al inicio de sesión
        </Link>
      </section>
    );
  }

  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="brand">Panel administrativo</p>
          <h1 className="title">Registros de informes</h1>
          <p className="subtitle">
            Revise el historial por mes, agregue registros manuales o edite los existentes.
          </p>
        </div>
        <div className="admin-actions">
          <Link className="nav-link" to="/">
            Volver al formulario
          </Link>
          <button className="nav-button" type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="month-list">
        {monthOptions.map((monthKey) => (
          <button
            key={monthKey}
            type="button"
            className={`month-button ${
              monthKey === selectedMonthKey ? "active" : ""
            }`}
            onClick={() => setSelectedMonthKey(monthKey)}
          >
            {getReportingLabelFromKey(monthKey)}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <button
          className="secondary-button"
          type="button"
          onClick={() => resetAdminForm(defaultMonthKey)}
        >
          Nuevo registro
        </button>
      </div>

      <form className="form" onSubmit={handleAdminSubmit} noValidate>
        <div className="field">
          <label htmlFor="admin-month">
            Mes del informe <span className="required">*</span>
          </label>
          <input
            id="admin-month"
            name="admin-month"
            type="month"
            value={adminForm.reportMonthKey}
            onChange={(event) => updateAdminForm("reportMonthKey", event.target.value)}
            aria-invalid={Boolean(formErrors.reportMonthKey)}
            aria-describedby={formErrors.reportMonthKey ? "month-error" : undefined}
            required
          />
          {formErrors.reportMonthKey ? (
            <span id="month-error" className="error">
              {formErrors.reportMonthKey}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="admin-name">
            Nombre <span className="required">*</span>
          </label>
          <input
            id="admin-name"
            name="admin-name"
            type="text"
            value={adminForm.name}
            onChange={(event) => updateAdminForm("name", event.target.value)}
            aria-invalid={Boolean(formErrors.name)}
            aria-describedby={formErrors.name ? "admin-name-error" : undefined}
            required
          />
          {formErrors.name ? (
            <span id="admin-name-error" className="error">
              {formErrors.name}
            </span>
          ) : null}
        </div>

        <fieldset className="field">
          <legend>
            Participación <span className="required">*</span>
          </legend>
          <div className="options">
            <label className="option">
              <input
                type="radio"
                name="admin-participation"
                value="Sí participé."
                checked={adminForm.participation === "Sí participé."}
                onChange={(event) => updateAdminForm("participation", event.target.value)}
                required
              />
              Sí participé.
            </label>
            <label className="option">
              <input
                type="radio"
                name="admin-participation"
                value="No participé."
                checked={adminForm.participation === "No participé."}
                onChange={(event) => updateAdminForm("participation", event.target.value)}
                required
              />
              No participé.
            </label>
          </div>
          {formErrors.participation ? (
            <span className="error">{formErrors.participation}</span>
          ) : null}
        </fieldset>

        <div className="field">
          <label htmlFor="admin-hours">
            Horas (para precursores auxiliares y regulares)
          </label>
          <input
            id="admin-hours"
            name="admin-hours"
            type="number"
            min="0"
            inputMode="numeric"
            value={adminForm.hours}
            onChange={(event) => updateAdminForm("hours", event.target.value)}
            aria-invalid={Boolean(formErrors.hours)}
            aria-describedby={formErrors.hours ? "admin-hours-error" : undefined}
          />
          {formErrors.hours ? (
            <span id="admin-hours-error" className="error">
              {formErrors.hours}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="admin-courses">Número de diferentes cursos bíblicos dirigidos</label>
          <input
            id="admin-courses"
            name="admin-courses"
            type="number"
            min="0"
            inputMode="numeric"
            value={adminForm.courses}
            onChange={(event) => updateAdminForm("courses", event.target.value)}
            aria-invalid={Boolean(formErrors.courses)}
            aria-describedby={formErrors.courses ? "admin-courses-error" : undefined}
          />
          {formErrors.courses ? (
            <span id="admin-courses-error" className="error">
              {formErrors.courses}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="admin-comments">Comentarios</label>
          <textarea
            id="admin-comments"
            name="admin-comments"
            rows="4"
            value={adminForm.comments}
            onChange={(event) => updateAdminForm("comments", event.target.value)}
          />
        </div>

        <div className="form-actions">
          <button className="submit" type="submit" disabled={submitStatus === "loading"}>
            {submitStatus === "loading"
              ? "Guardando..."
              : editingId
              ? "Actualizar informe"
              : "Agregar informe"}
          </button>
          {editingId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => resetAdminForm(defaultMonthKey)}
            >
              Cancelar edición
            </button>
          ) : null}
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

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Nombre</th>
              <th>Participación</th>
              <th>Horas</th>
              <th>Cursos</th>
              <th>Comentarios</th>
              <th>Enviado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>Cargando registros...</td>
              </tr>
            ) : null}
            {!isLoading && loadError ? (
              <tr>
                <td colSpan={8}>{loadError}</td>
              </tr>
            ) : null}
            {!isLoading && !loadError && filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8}>No hay registros disponibles.</td>
              </tr>
            ) : null}
            {!isLoading &&
              !loadError &&
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reportMonthLabel}</td>
                  <td>{report.name}</td>
                  <td>{report.participation}</td>
                  <td>{report.hours || "-"}</td>
                  <td>{report.courses || "-"}</td>
                  <td>{report.comments || "-"}</td>
                  <td>{formatDateTime(report.submittedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="table-button"
                        type="button"
                        onClick={() => handleEdit(report)}
                      >
                        Editar
                      </button>
                      <button
                        className="table-button danger"
                        type="button"
                        onClick={() => handleDelete(report.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const NotFoundView = () => (
  <section>
    <h1 className="title">Página no encontrada</h1>
    <p className="subtitle">La ruta solicitada no existe.</p>
    <Link className="nav-link" to="/">
      Volver al formulario
    </Link>
  </section>
);

export default function App() {
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    setAuthToken(getStoredToken());
  }, []);

  const handleLogin = (token) => {
    storeToken(token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    clearToken();
    setAuthToken("");
  };

  return (
    <div className="page">
      <main className="card">
        <Routes>
          <Route path="/" element={<ReportFormView />} />
          <Route path="/login" element={<LoginView onLogin={handleLogin} />} />
          <Route
            path="/admin"
            element={<AdminView authToken={authToken} onLogout={handleLogout} />}
          />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Link } from "react-router-dom";
import {
  formatDateTime,
  getReportDate,
  getReportDateFromKey,
  getReportMonthKey,
  getReportingLabelFromKey,
  isNumericValue,
} from "../utils/reporting.js";

const buildDefaultAdminForm = (defaultMonthKey) => ({
  reportMonthKey: defaultMonthKey,
  name: "",
  participation: "",
  hours: "",
  courses: "",
  comments: "",
});

export default function AdminView({ authToken, onLogout }) {
  const defaultMonthKey = useMemo(
    () => getReportMonthKey(getReportDate(new Date())),
    []
  );

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(defaultMonthKey);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
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
  }, [reports, defaultMonthKey]);

  const archiveMonthOptions = useMemo(() => {
    return monthOptions.filter((monthKey) => monthKey !== defaultMonthKey);
  }, [monthOptions, defaultMonthKey]);

  const activeMonthKey = selectedMonthKey || defaultMonthKey;
  const activeMonthLabel = useMemo(
    () => getReportingLabelFromKey(activeMonthKey),
    [activeMonthKey]
  );
  const currentMonthLabel = useMemo(
    () => getReportingLabelFromKey(defaultMonthKey),
    [defaultMonthKey]
  );

  const filteredReports = useMemo(() => {
    return reports.filter((report) => report.reportMonthKey === activeMonthKey);
  }, [reports, activeMonthKey]);

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

  const openNewModal = () => {
    resetAdminForm(activeMonthKey);
    setSubmitMessage("");
    setSubmitStatus("idle");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetAdminForm(activeMonthKey);
    setSubmitMessage("");
    setSubmitStatus("idle");
    setIsModalOpen(false);
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
    if (!selectedMonthKey || !monthOptions.includes(selectedMonthKey)) {
      setSelectedMonthKey(defaultMonthKey);
    }
  }, [defaultMonthKey, monthOptions, selectedMonthKey]);

  const handleArchiveChange = (event) => {
    const value = event.target.value;
    setSelectedMonthKey(value || defaultMonthKey);
  };

  const handleDownloadPdf = () => {
    const monthKey = defaultMonthKey;
    const monthLabel = currentMonthLabel;
    const monthReports = reports.filter((report) => report.reportMonthKey === monthKey);

    const document = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = document.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 40;

    const ensureSpace = (spaceNeeded) => {
      if (y + spaceNeeded > 760) {
        document.addPage();
        y = 40;
      }
    };

    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text(`Informe mensual - ${monthLabel}`, marginX, y);
    y += 20;

    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.text(`Generado: ${formatDateTime(new Date())}`, marginX, y);
    y += 20;

    if (monthReports.length === 0) {
      document.text("No hay registros para este mes.", marginX, y);
      document.save(`informes-${monthKey}.pdf`);
      return;
    }

    monthReports.forEach((report, index) => {
      ensureSpace(100);

      document.setFont("helvetica", "bold");
      document.setFontSize(12);
      document.text(`${index + 1}. ${report.name}`, marginX, y);
      y += 16;

      document.setFont("helvetica", "normal");
      document.setFontSize(10);

      const lines = [
        `Participación: ${report.participation || "-"}`,
        `Horas: ${report.hours || "-"}`,
        `Cursos: ${report.courses || "-"}`,
        `Enviado: ${formatDateTime(report.submittedAt) || "-"}`,
      ];

      lines.forEach((line) => {
        ensureSpace(14);
        document.text(line, marginX, y);
        y += 14;
      });

      const comments = report.comments?.trim() ? report.comments.trim() : "-";
      const commentLines = document.splitTextToSize(
        `Comentarios: ${comments}`,
        pageWidth - marginX * 2
      );

      commentLines.forEach((line) => {
        ensureSpace(14);
        document.text(line, marginX, y);
        y += 14;
      });

      y += 6;
      document.setDrawColor(148, 163, 184);
      document.setLineWidth(0.5);
      ensureSpace(12);
      document.line(marginX, y, pageWidth - marginX, y);
      y += 12;
    });

    document.save(`informes-${monthKey}.pdf`);
  };

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
    setSubmitMessage("");
    setSubmitStatus("idle");
    setIsModalOpen(true);
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
      setIsModalOpen(false);
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
        </div>
      </div>

      <div className="month-toolbar">
        <div className="month-current">
          <span className="month-label">Mes actual</span>
          <span className="month-chip">{currentMonthLabel}</span>
          {activeMonthKey !== defaultMonthKey ? (
            <button
              className="link-button"
              type="button"
              onClick={() => setSelectedMonthKey(defaultMonthKey)}
            >
              Ver mes actual
            </button>
          ) : null}
        </div>
        <div className="month-archive">
          <label htmlFor="archive-month">Archivo</label>
          <select
            id="archive-month"
            value={activeMonthKey === defaultMonthKey ? "" : activeMonthKey}
            onChange={handleArchiveChange}
          >
            <option value="">Seleccionar mes</option>
            {archiveMonthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {getReportingLabelFromKey(monthKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <span className="month-caption">Mostrando: {activeMonthLabel}</span>
        </div>
        <div className="admin-toolbar-right">
          <button className="secondary-button" type="button" onClick={openNewModal}>
            Nuevo registro
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleDownloadPdf}
            disabled={activeMonthKey !== defaultMonthKey}
          >
            Descargar PDF del mes
          </button>
        </div>
      </div>

      {isModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="brand">Registro manual</p>
                <h2 className="modal-title">
                  {editingId ? "Editar informe" : "Agregar informe"}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal}>
                Cerrar
              </button>
            </div>

            <form className="form modal-body" onSubmit={handleAdminSubmit} noValidate>
              <div className="field">
                <label htmlFor="admin-month">
                  Mes del informe <span className="required">*</span>
                </label>
                <input
                  id="admin-month"
                  name="admin-month"
                  type="month"
                  value={adminForm.reportMonthKey}
                  onChange={(event) =>
                    updateAdminForm("reportMonthKey", event.target.value)
                  }
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
                  <label
                    className={`option-card ${
                      adminForm.participation === "Sí participé." ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-participation"
                      value="Sí participé."
                      checked={adminForm.participation === "Sí participé."}
                      onChange={(event) =>
                        updateAdminForm("participation", event.target.value)
                      }
                      required
                    />
                    <span className="option-text">Sí participé.</span>
                  </label>
                  <label
                    className={`option-card ${
                      adminForm.participation === "No participé." ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-participation"
                      value="No participé."
                      checked={adminForm.participation === "No participé."}
                      onChange={(event) =>
                        updateAdminForm("participation", event.target.value)
                      }
                      required
                    />
                    <span className="option-text">No participé.</span>
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
                <label htmlFor="admin-courses">
                  Número de diferentes cursos bíblicos dirigidos
                </label>
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
                <button
                  className="submit"
                  type="submit"
                  disabled={submitStatus === "loading"}
                >
                  {submitStatus === "loading"
                    ? "Guardando..."
                    : editingId
                    ? "Actualizar informe"
                    : "Agregar informe"}
                </button>
                <button className="secondary-button" type="button" onClick={closeModal}>
                  Cancelar
                </button>
              </div>

              {submitMessage ? (
                <div
                  className={`feedback ${
                    submitStatus === "success" ? "success" : "error"
                  }`}
                  role="status"
                >
                  {submitMessage}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

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
}

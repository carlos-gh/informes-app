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
  designation: "Publicador",
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
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(defaultMonthKey);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [pendingError, setPendingError] = useState("");
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

  const loadPeople = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      const response = await fetch("/api/people", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        setPendingError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load people");
      }

      const data = await response.json();
      setPeople(data.items || []);
    } catch (error) {
      setPendingError("No se pudieron cargar las personas.");
    }
  };

  useEffect(() => {
    loadReports();
    loadPeople();
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

  const normalizeName = (value) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getPendingPeople = () => {
    const reportedNames = new Set(
      filteredReports.map((report) => normalizeName(report.name || ""))
    );

    return people.filter((person) => {
      const normalized = normalizeName(person.name || "");
      return normalized && !reportedNames.has(normalized);
    });
  };

  const handleDownloadPdf = () => {
    const monthKey = defaultMonthKey;
    const monthLabel = currentMonthLabel;
    const monthReports = reports.filter((report) => report.reportMonthKey === monthKey);

    const document = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const marginX = 40;
    const marginY = 32;
    const tableWidth = pageWidth - marginX * 2;
    const headerBarHeight = 26;
    const headerRowHeight = 28;
    const rowHeight = 22;

    const columns = [
      { key: "index", label: "No.", width: 30, align: "center" },
      { key: "name", label: "Nombre", width: 130, align: "left" },
      { key: "participation", label: "Participó", width: 60, align: "center" },
      { key: "hours", label: "Horas", width: 45, align: "center" },
      { key: "courses", label: "Cursos", width: 45, align: "center" },
      { key: "designation", label: "Designación", width: 80, align: "left" },
      { key: "comments", label: "Comentarios", width: 0, align: "left" },
    ];

    const fixedWidth = columns.reduce(
      (total, column) => total + (column.width || 0),
      0
    );
    const commentsColumn = columns.find((column) => column.key === "comments");
    commentsColumn.width = Math.max(tableWidth - fixedWidth, 120);

    const drawTopHeader = () => {
      document.setFont("helvetica", "normal");
      document.setFontSize(10);
      document.setTextColor(40, 40, 40);
      document.text("Informes Grupo 4", marginX, marginY);
      const monthWidth = document.getTextWidth(monthLabel);
      document.text(monthLabel, pageWidth - marginX - monthWidth, marginY);

      document.setFillColor(90, 90, 90);
      document.rect(marginX, marginY + 20, tableWidth, headerBarHeight, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(12);
      document.setTextColor(255, 255, 255);
      const title = `INFORMES GRUPO 4 / MES: ${monthLabel.toUpperCase()}`;
      document.text(title, pageWidth / 2, marginY + 38, { align: "center" });
    };

    const drawTableHeader = (y) => {
      document.setFillColor(224, 114, 0);
      document.rect(marginX, y, tableWidth, headerRowHeight, "F");

      let x = marginX;
      document.setFont("helvetica", "bold");
      document.setFontSize(9);
      document.setTextColor(255, 255, 255);

      columns.forEach((column) => {
        const textX = column.align === "center" ? x + column.width / 2 : x + 6;
        document.text(column.label, textX, y + 18, {
          align: column.align === "center" ? "center" : "left",
        });
        document.setDrawColor(200, 200, 200);
        document.rect(x, y, column.width, headerRowHeight, "S");
        x += column.width;
      });

      document.setTextColor(40, 40, 40);
      return y + headerRowHeight;
    };

    const drawRow = (y, cells, options = {}) => {
      let x = marginX;
      document.setFont("helvetica", options.bold ? "bold" : "normal");
      document.setFontSize(9);
      const textColor = options.textColor || [30, 30, 30];
      document.setTextColor(textColor[0], textColor[1], textColor[2]);

      if (options.fill) {
        const fillColor = options.fillColor || [235, 235, 235];
        document.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      }

      columns.forEach((column) => {
        const value = cells[column.key] ?? "";
        document.setDrawColor(200, 200, 200);
        document.rect(x, y, column.width, rowHeight, options.fill ? "FD" : "S");
        const textX = column.align === "center" ? x + column.width / 2 : x + 6;
        const text = String(value);
        document.text(text, textX, y + 14, {
          align: column.align === "center" ? "center" : "left",
        });
        x += column.width;
      });

      return y + rowHeight;
    };

    const ensureSpace = (y) => {
      if (y + rowHeight > pageHeight - marginY) {
        document.addPage();
        drawTopHeader();
        return drawTableHeader(marginY + 52);
      }
      return y;
    };

    drawTopHeader();
    let y = drawTableHeader(marginY + 52);

    if (monthReports.length === 0) {
      document.setFont("helvetica", "normal");
      document.setFontSize(10);
      document.setTextColor(40, 40, 40);
      document.text("No hay registros para este mes.", marginX, y + 20);
      document.save(`informes-${monthKey}.pdf`);
      return;
    }

    let totalHours = 0;
    let totalCourses = 0;

    monthReports.forEach((report, index) => {
      y = ensureSpace(y);
      const hoursValue = Number.parseFloat(report.hours);
      const coursesValue = Number.parseFloat(report.courses);
      if (!Number.isNaN(hoursValue)) {
        totalHours += hoursValue;
      }
      if (!Number.isNaN(coursesValue)) {
        totalCourses += coursesValue;
      }

      const comments = report.comments?.trim() ? report.comments.trim() : "-";
      const commentLines = document.splitTextToSize(
        comments,
        commentsColumn.width - 12
      );
      const commentText = commentLines[0] || "-";

      y = drawRow(y, {
        index: index + 1,
        name: report.name || "-",
        participation:
          report.participation === "Sí participé." ? "Sí" : "No",
        hours: report.hours || "-",
        courses: report.courses || "-",
        designation: report.designation || "Publicador",
        comments: commentText,
      });
    });

    y = ensureSpace(y);
    drawRow(
      y,
      {
        index: "",
        name: "Totales:",
        participation: "",
        hours: totalHours ? String(totalHours) : "-",
        courses: totalCourses ? String(totalCourses) : "-",
        designation: "",
        comments: "",
      },
      { fill: true, fillColor: [235, 235, 235], bold: true, textColor: [20, 20, 20] }
    );

    document.save(`informes-${monthKey}.pdf`);
  };

  const handleEdit = (report) => {
    setEditingId(report.id);
    setAdminForm({
      reportMonthKey: report.reportMonthKey || defaultMonthKey,
      name: report.name || "",
      participation: report.participation || "",
      designation: report.designation || "Publicador",
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
      const response = await fetch(`/api/reports?id=${reportId}`, {
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
      designation: adminForm.designation,
      hours: adminForm.hours.trim(),
      courses: adminForm.courses.trim(),
      comments: adminForm.comments.trim(),
    };

    try {
      const response = await fetch(
        editingId ? `/api/reports?id=${editingId}` : "/api/reports",
        {
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
            onClick={() => setIsPendingOpen(true)}
          >
            Pendientes
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

              <div className="field">
                <label htmlFor="admin-designation">Designación</label>
                <select
                  id="admin-designation"
                  name="admin-designation"
                  value={adminForm.designation}
                  onChange={(event) =>
                    updateAdminForm("designation", event.target.value)
                  }
                >
                  <option value="Publicador">Publicador</option>
                  <option value="Precursor Auxiliar">Precursor Auxiliar</option>
                  <option value="Precursor Regular">Precursor Regular</option>
                </select>
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

      {isPendingOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="brand">Pendientes</p>
                <h2 className="modal-title">Faltan por enviar</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsPendingOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              {pendingError ? (
                <div className="feedback error" role="status">
                  {pendingError}
                </div>
              ) : null}
              {!pendingError && people.length === 0 ? (
                <p className="subtitle">
                  No hay personas registradas para comparar.
                </p>
              ) : null}
              {!pendingError && people.length > 0 ? (
                <>
                  <p className="subtitle">
                    Mes seleccionado: {activeMonthLabel}
                  </p>
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Nombre</th>
                          <th>Grupo</th>
                          <th>Designación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPendingPeople().length === 0 ? (
                          <tr>
                            <td colSpan={4}>No hay pendientes.</td>
                          </tr>
                        ) : (
                          getPendingPeople().map((person, index) => (
                            <tr key={person.id}>
                              <td>{index + 1}</td>
                              <td>{person.name}</td>
                              <td>{person.groupNumber ?? "-"}</td>
                              <td>{person.designation || "Publicador"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Mes</th>
              <th>Nombre</th>
              <th>Participación</th>
              <th>Horas</th>
              <th>Cursos</th>
              <th>Comentarios</th>
              <th>Enviado</th>
              <th>Designación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10}>Cargando registros...</td>
              </tr>
            ) : null}
            {!isLoading && loadError ? (
              <tr>
                <td colSpan={10}>{loadError}</td>
              </tr>
            ) : null}
            {!isLoading && !loadError && filteredReports.length === 0 ? (
              <tr>
                <td colSpan={10}>No hay registros disponibles.</td>
              </tr>
            ) : null}
            {!isLoading &&
              !loadError &&
              filteredReports.map((report, index) => (
                <tr key={report.id}>
                  <td>{index + 1}</td>
                  <td>{report.reportMonthLabel}</td>
                  <td>{report.name}</td>
                  <td>{report.participation}</td>
                  <td>{report.hours || "-"}</td>
                  <td>{report.courses || "-"}</td>
                  <td>{report.comments || "-"}</td>
                  <td>{formatDateTime(report.submittedAt)}</td>
                  <td>{report.designation || "Publicador"}</td>
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

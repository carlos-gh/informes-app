import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminMonthDetailView from "./AdminMonthDetailView.jsx";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const CLOSED_PERIODS_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const OPEN_PERIODS_SKELETON_ITEMS = Array.from({ length: 2 }, (_, index) => index);

export default function AdminView({ authToken, onLogout }) {
  const navigate = useNavigate();
  const { monthKey: routeMonthKey = "" } = useParams();
  const isDetailView = Boolean(routeMonthKey);
  const defaultMonthKey = useMemo(
    () => getReportMonthKey(getReportDate(new Date())),
    []
  );

  const [reports, setReports] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(defaultMonthKey);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [statsRange, setStatsRange] = useState(6);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [adminForm, setAdminForm] = useState(buildDefaultAdminForm(defaultMonthKey));
  const [formErrors, setFormErrors] = useState({});

  const isAuthenticated = Boolean(authToken);

  const closedPeriods = useMemo(() => {
    return (periods || [])
      .filter((period) => true === period.isClosed)
      .sort((a, b) => b.reportMonthKey.localeCompare(a.reportMonthKey));
  }, [periods]);

  const closedMonthKeys = useMemo(() => {
    return closedPeriods.map((period) => period.reportMonthKey).filter(Boolean);
  }, [closedPeriods]);

  const reportMonthKeys = useMemo(() => {
    return Array.from(
      new Set(reports.map((report) => report.reportMonthKey).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const closedMonthKeySet = useMemo(() => {
    return new Set(closedMonthKeys);
  }, [closedMonthKeys]);

  const availableMonthKeys = useMemo(() => {
    const uniqueKeys = new Set([defaultMonthKey, ...reportMonthKeys, ...closedMonthKeys]);
    return Array.from(uniqueKeys)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [defaultMonthKey, reportMonthKeys, closedMonthKeys]);

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
  const isActiveMonthClosed = useMemo(() => {
    return closedMonthKeySet.has(activeMonthKey);
  }, [activeMonthKey, closedMonthKeySet]);

  const reportSummaryByMonth = useMemo(() => {
    const summary = new Map();

    reports.forEach((report) => {
      const monthKey = report.reportMonthKey;

      if (!monthKey) {
        return;
      }

      if (!summary.has(monthKey)) {
        summary.set(monthKey, {
          totalReports: 0,
          totalHours: 0,
          totalCourses: 0,
        });
      }

      const entry = summary.get(monthKey);
      entry.totalReports += 1;

      const hoursValue = Number.parseFloat(report.hours);
      const coursesValue = Number.parseFloat(report.courses);

      if (!Number.isNaN(hoursValue)) {
        entry.totalHours += hoursValue;
      }

      if (!Number.isNaN(coursesValue)) {
        entry.totalCourses += coursesValue;
      }
    });

    return summary;
  }, [reports]);

  const closedPeriodSummaries = useMemo(() => {
    return closedPeriods.map((period) => {
      const summary = reportSummaryByMonth.get(period.reportMonthKey) || {
        totalReports: 0,
        totalHours: 0,
        totalCourses: 0,
      };

      return {
        ...period,
        totalReports: summary.totalReports,
        totalHours: summary.totalHours,
        totalCourses: summary.totalCourses,
      };
    });
  }, [closedPeriods, reportSummaryByMonth]);

  const openMonthKeys = useMemo(() => {
    return availableMonthKeys.filter((monthKey) => !closedMonthKeySet.has(monthKey));
  }, [availableMonthKeys, closedMonthKeySet]);

  const openPeriodSummaries = useMemo(() => {
    return openMonthKeys.map((monthKey) => {
      const summary = reportSummaryByMonth.get(monthKey) || {
        totalReports: 0,
        totalHours: 0,
        totalCourses: 0,
      };

      return {
        reportMonthKey: monthKey,
        reportMonthLabel: getReportingLabelFromKey(monthKey),
        totalReports: summary.totalReports,
        totalHours: summary.totalHours,
        totalCourses: summary.totalCourses,
      };
    });
  }, [openMonthKeys, reportSummaryByMonth]);

  const lastMonthKeys = useMemo(() => {
    const keys = Array.from(
      new Set(reports.map((report) => report.reportMonthKey).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
    return keys.slice(0, statsRange).reverse();
  }, [reports, statsRange]);

  const statsData = useMemo(() => {
    const base = lastMonthKeys.map((key) => ({
      key,
      label: getReportingLabelFromKey(key),
      hours: 0,
      courses: 0,
      auxiliary: 0,
      regular: 0,
    }));

    const summary = new Map(base.map((item) => [item.key, item]));

    reports.forEach((report) => {
      if (!summary.has(report.reportMonthKey)) {
        return;
      }

      const entry = summary.get(report.reportMonthKey);
      const hoursValue = Number.parseFloat(report.hours);
      const coursesValue = Number.parseFloat(report.courses);

      if (!Number.isNaN(hoursValue)) {
        entry.hours += hoursValue;
      }

      if (!Number.isNaN(coursesValue)) {
        entry.courses += coursesValue;
      }

      if (report.designation === "Precursor Auxiliar") {
        entry.auxiliary += 1;
      }

      if (report.designation === "Precursor Regular") {
        entry.regular += 1;
      }
    });

    return Array.from(summary.values());
  }, [reports, lastMonthKeys]);

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
    if (isActiveMonthClosed) {
      setSubmitStatus("error");
      setSubmitMessage("Este periodo está completado y solo permite vista previa.");
      return;
    }

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

  const getErrorMessageFromResponse = async (response, fallbackMessage) => {
    try {
      const data = await response.json();
      const apiError = String(data?.error || "").trim();

      if ("Report period is closed" === apiError) {
        return "Este periodo está completado y solo permite vista previa.";
      }

      if ("Cannot close period without reports" === apiError) {
        return "No se puede cerrar un periodo sin informes.";
      }

      if ("Report period is already open" === apiError) {
        return "Este periodo ya está abierto.";
      }

      return apiError || fallbackMessage;
    } catch (error) {
      return fallbackMessage;
    }
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
      setPeriods(data.periods || []);
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

    setPendingError("");

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
      setPendingError("");
    } catch (error) {
      setPendingError("No se pudieron cargar las personas.");
    }
  };

  useEffect(() => {
    loadReports();
    loadPeople();
  }, [authToken]);

  useEffect(() => {
    if (!selectedMonthKey || !availableMonthKeys.includes(selectedMonthKey)) {
      setSelectedMonthKey(defaultMonthKey);
    }
  }, [defaultMonthKey, availableMonthKeys, selectedMonthKey]);

  useEffect(() => {
    if (!isDetailView) {
      return;
    }

    if (availableMonthKeys.includes(routeMonthKey)) {
      setSelectedMonthKey(routeMonthKey);
      return;
    }

    navigate("/admin", { replace: true });
  }, [availableMonthKeys, isDetailView, navigate, routeMonthKey]);

  const selectMonth = (monthKey, options = {}) => {
    const nextMonthKey = monthKey || defaultMonthKey;
    setSelectedMonthKey(nextMonthKey);

    if (options.openDetail) {
      navigate(`/admin/${nextMonthKey}`);
      return;
    }

    if (isDetailView) {
      navigate(`/admin/${nextMonthKey}`);
    }
  };

  const handleBackToOverview = () => {
    navigate("/admin");
  };

  const handleClosePeriod = async () => {
    if (!canClosePeriod) {
      setSubmitStatus("error");
      setSubmitMessage(
        closePeriodBlockReason || "No se puede cerrar el periodo seleccionado."
      );
      return;
    }

    if (
      !window.confirm(
        `¿Desea cerrar el periodo de ${activeMonthLabel}? El mes quedará en modo solo vista previa.`
      )
    ) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: "closePeriod",
          reportMonthKey: activeMonthKey,
        }),
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo cerrar el periodo."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage(
        "Periodo completado correctamente. Este mes ahora está en modo vista previa."
      );
      await loadReports();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo cerrar el periodo."));
    }
  };

  const handleReopenPeriod = async () => {
    if (!canReopenPeriod) {
      setSubmitStatus("error");
      setSubmitMessage(
        reopenPeriodBlockReason || "No se puede reabrir el periodo seleccionado."
      );
      return;
    }

    if (
      !window.confirm(
        `¿Desea reabrir el periodo de ${activeMonthLabel}? El mes volverá a estar habilitado para edición.`
      )
    ) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: "reopenPeriod",
          reportMonthKey: activeMonthKey,
        }),
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo reabrir el periodo."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage("Periodo reabierto correctamente. Ya puede editar registros.");
      await loadReports();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo reabrir el periodo."));
    }
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

  const pendingPeople = useMemo(() => {
    const reportedNames = new Set(
      filteredReports.map((report) => normalizeName(report.name || ""))
    );

    return people.filter((person) => {
      const normalized = normalizeName(person.name || "");
      return normalized && !reportedNames.has(normalized);
    });
  }, [filteredReports, people]);

  const closePeriodBlockReason = useMemo(() => {
    if (isActiveMonthClosed) {
      return "Este periodo ya está completado.";
    }

    if (pendingError) {
      return "No se pudo validar la lista de pendientes.";
    }

    if (0 === people.length) {
      return "Debe registrar personas para validar pendientes.";
    }

    if (0 === filteredReports.length) {
      return "No hay informes cargados para este mes.";
    }

    if (0 < pendingPeople.length) {
      return "Aún hay personas pendientes por informar.";
    }

    return "";
  }, [
    filteredReports.length,
    isActiveMonthClosed,
    pendingError,
    pendingPeople.length,
    people.length,
  ]);

  const canClosePeriod = "" === closePeriodBlockReason;
  const reopenPeriodBlockReason = useMemo(() => {
    if (!isActiveMonthClosed) {
      return "Este periodo ya está abierto.";
    }

    return "";
  }, [isActiveMonthClosed]);
  const canReopenPeriod = "" === reopenPeriodBlockReason;

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

      columns.forEach((column) => {
        const value = cells[column.key] ?? "";
        if (options.fill) {
          const fillColor = options.fillColor || [235, 235, 235];
          document.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        }
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
      { fill: true, fillColor: [245, 245, 245], bold: true, textColor: [20, 20, 20] }
    );

    document.save(`informes-${monthKey}.pdf`);
  };

  const handleEdit = (report) => {
    if (closedMonthKeySet.has(report.reportMonthKey)) {
      setSubmitStatus("error");
      setSubmitMessage("Este periodo está completado y solo permite vista previa.");
      return;
    }

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
    const report = reports.find((entry) => entry.id === reportId);

    if (report && closedMonthKeySet.has(report.reportMonthKey)) {
      setSubmitStatus("error");
      setSubmitMessage("Este periodo está completado y solo permite vista previa.");
      return;
    }

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
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo eliminar el registro."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage("El registro fue eliminado.");
      await loadReports();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo eliminar el registro."));
    }
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (closedMonthKeySet.has(adminForm.reportMonthKey)) {
      setSubmitStatus("error");
      setSubmitMessage("Este periodo está completado y solo permite vista previa.");
      return;
    }

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
        }
      );

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo guardar el registro."
        );
        throw new Error(errorMessage);
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
      setSubmitMessage(String(error.message || "No se pudo guardar el registro."));
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

      {!isDetailView ? (
        <>
          <section className="closed-periods">
            <div className="closed-periods-header">
              <h2 className="closed-periods-title">Periodos abiertos</h2>
              <p className="closed-periods-subtitle">
                Seleccione un periodo abierto para registrar o editar informes.
              </p>
            </div>
            <div className="closed-periods-list">
              {isLoading
                ? OPEN_PERIODS_SKELETON_ITEMS.map((index) => (
                    <div
                      key={`open-period-skeleton-${index}`}
                      className="closed-period-item closed-period-item-skeleton"
                    >
                      <span className="skeleton-line skeleton-lg" />
                      <span className="skeleton-line skeleton-xl" />
                      <span className="skeleton-line skeleton-md" />
                    </div>
                  ))
                : openPeriodSummaries.map((period) => (
                    <button
                      key={period.reportMonthKey}
                      className={`closed-period-item ${
                        activeMonthKey === period.reportMonthKey ? "active" : ""
                      }`}
                      type="button"
                      onClick={() =>
                        selectMonth(period.reportMonthKey, { openDetail: true })
                      }
                    >
                      <span className="closed-period-month">{period.reportMonthLabel}</span>
                      <span className="closed-period-meta">
                        Informes: {period.totalReports} · Horas: {period.totalHours} · Cursos:{" "}
                        {period.totalCourses}
                      </span>
                      <span className="closed-period-meta">Estado: abierto</span>
                    </button>
                  ))}
            </div>
          </section>

          <section className="closed-periods">
            <div className="closed-periods-header">
              <h2 className="closed-periods-title">Meses completados</h2>
              <p className="closed-periods-subtitle">
                Seleccione un mes para abrir sus detalles.
              </p>
            </div>
            <div className="closed-periods-list">
              {isLoading
                ? CLOSED_PERIODS_SKELETON_ITEMS.map((index) => (
                    <div
                      key={`closed-period-skeleton-${index}`}
                      className="closed-period-item closed-period-item-skeleton"
                    >
                      <span className="skeleton-line skeleton-lg" />
                      <span className="skeleton-line skeleton-xl" />
                      <span className="skeleton-line skeleton-md" />
                    </div>
                  ))
                : null}
              {!isLoading && 0 === closedPeriodSummaries.length ? (
                <div className="closed-period-item closed-period-item-skeleton">
                  <span className="closed-period-meta">
                    Aún no hay meses completados.
                  </span>
                </div>
              ) : null}
              {!isLoading
                ? closedPeriodSummaries.map((period) => (
                    <button
                      key={period.reportMonthKey}
                      className={`closed-period-item ${
                        activeMonthKey === period.reportMonthKey ? "active" : ""
                      }`}
                      type="button"
                      onClick={() =>
                        selectMonth(period.reportMonthKey, { openDetail: true })
                      }
                    >
                      <span className="closed-period-month">{period.reportMonthLabel}</span>
                      <span className="closed-period-meta">
                        Informes: {period.totalReports} · Horas: {period.totalHours} · Cursos:{" "}
                        {period.totalCourses}
                      </span>
                      <span className="closed-period-meta">
                        Completado: {formatDateTime(period.closedAt)}
                      </span>
                    </button>
                  ))
                : null}
            </div>
          </section>
        </>
      ) : null}

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
                        {pendingPeople.length === 0 ? (
                          <tr>
                            <td colSpan={4}>No hay pendientes.</td>
                          </tr>
                        ) : (
                          pendingPeople.map((person, index) => (
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

      {isStatsOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <p className="brand">Estadísticas</p>
                <h2 className="modal-title">Resumen de los últimos meses</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsStatsOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              <div className="stats-toolbar">
                <label htmlFor="stats-range">Meses a comparar</label>
                <select
                  id="stats-range"
                  value={statsRange}
                  onChange={(event) => setStatsRange(Number(event.target.value))}
                >
                  <option value={3}>Últimos 3</option>
                  <option value={4}>Últimos 4</option>
                  <option value={5}>Últimos 5</option>
                  <option value={6}>Últimos 6</option>
                </select>
              </div>

              {lastMonthKeys.length === 0 ? (
                <p className="subtitle">No hay datos suficientes para estadísticas.</p>
              ) : (
                <div className="stats-grid">
                  <div className="stats-card">
                    <h3>Horas totales</h3>
                    <div className="stats-chart">
                      <Line
                        data={{
                          labels: statsData.map((item) => item.label),
                          datasets: [
                            {
                              label: "Horas",
                              data: statsData.map((item) => item.hours),
                              borderColor: "#8b5cf6",
                              backgroundColor: "rgba(139, 92, 246, 0.2)",
                              tension: 0.35,
                              fill: true,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            x: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                            y: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div className="stats-card">
                    <h3>Cursos bíblicos</h3>
                    <div className="stats-chart">
                      <Bar
                        data={{
                          labels: statsData.map((item) => item.label),
                          datasets: [
                            {
                              label: "Cursos",
                              data: statsData.map((item) => item.courses),
                              backgroundColor: "rgba(56, 189, 248, 0.6)",
                              borderColor: "#38bdf8",
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            x: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                            y: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div className="stats-card">
                    <h3>Precursores</h3>
                    <div className="stats-chart">
                      <Bar
                        data={{
                          labels: statsData.map((item) => item.label),
                          datasets: [
                            {
                              label: "Auxiliar",
                              data: statsData.map((item) => item.auxiliary),
                              backgroundColor: "rgba(34, 197, 94, 0.65)",
                              borderColor: "#22c55e",
                            },
                            {
                              label: "Regular",
                              data: statsData.map((item) => item.regular),
                              backgroundColor: "rgba(249, 115, 22, 0.65)",
                              borderColor: "#f97316",
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { labels: { color: "#cbd5f5" } },
                          },
                          scales: {
                            x: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                            y: {
                              ticks: { color: "#cbd5f5" },
                              grid: { color: "rgba(148,163,184,0.2)" },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isDetailView ? (
        <div id="month-details">
          <AdminMonthDetailView
            activeMonthLabel={activeMonthLabel}
            canClosePeriod={canClosePeriod}
            canReopenPeriod={canReopenPeriod}
            canDownloadPdf={activeMonthKey === defaultMonthKey}
            closePeriodBlockReason={closePeriodBlockReason}
            reopenPeriodBlockReason={reopenPeriodBlockReason}
            filteredReports={filteredReports}
            isActiveMonthClosed={isActiveMonthClosed}
            isSubmitting={submitStatus === "loading"}
            isLoading={isLoading}
            loadError={loadError}
            onBack={handleBackToOverview}
            onClosePeriod={handleClosePeriod}
            onReopenPeriod={handleReopenPeriod}
            onDelete={handleDelete}
            onDownloadPdf={handleDownloadPdf}
            onEdit={handleEdit}
            onOpenNewModal={openNewModal}
            onOpenPending={() => setIsPendingOpen(true)}
            onOpenStats={() => setIsStatsOpen(true)}
          />
        </div>
      ) : null}
    </section>
  );
}

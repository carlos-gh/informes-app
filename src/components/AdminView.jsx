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
import ConfirmModal from "./ConfirmModal.jsx";
import {
  formatDateTime,
  getReportDate,
  getReportDateFromKey,
  getReportMonthKey,
  getReportingLabelFromKey,
  isNumericValue,
} from "../utils/reporting.js";

const buildDefaultAdminForm = (defaultMonthKey, defaultGroupNumber = "") => ({
  reportMonthKey: defaultMonthKey,
  groupNumber: defaultGroupNumber,
  name: "",
  participation: "",
  designation: "Publicador",
  hours: "",
  courses: "",
  comments: "",
});

const isValidGroupNumberValue = (value) => {
  const normalized = Number(value);

  return Number.isInteger(normalized) && normalized > 0;
};

const hasMissingGroupValue = (value) => {
  if (value === null || value === undefined) {
    return true;
  }

  const rawValue = String(value).trim();

  if (!rawValue) {
    return true;
  }

  return !isValidGroupNumberValue(rawValue);
};

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

// Module-level cache — persists across React Router remounts so navigating
// away and back does not trigger a full reload.
let _adminCache = null;

const CalendarIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 2v3M17 2v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const OpenLockIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 11V8a5 5 0 0 1 9.5-2M6 11h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const CheckCircleIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8 12 2.5 2.5L16 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const AdminSectionIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 5h16M6 5v14h12V5M9 13l2 2 4-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function AdminView({ authToken, authUser, onLogout }) {
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
  const [groups, setGroups] = useState([]);
  const [selectedGroupNumber, setSelectedGroupNumber] = useState("");
  const [adminForm, setAdminForm] = useState(() =>
    buildDefaultAdminForm(defaultMonthKey)
  );
  const [formErrors, setFormErrors] = useState({});
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "Confirmar acción",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
  });
  const [confirmResolver, setConfirmResolver] = useState(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [deletedReports, setDeletedReports] = useState([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);

  const isAuthenticated = Boolean(authToken);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);
  const canReassignGroupOnEdit = isSuperAdmin && editingId !== null;
  const defaultAdminGroupNumber = useMemo(() => {
    if (isSuperAdmin) {
      return "";
    }

    return authUser?.groupNumber ? String(authUser.groupNumber) : "";
  }, [authUser?.groupNumber, isSuperAdmin]);
  const hasUngroupedReports = useMemo(() => {
    return reports.some((report) => hasMissingGroupValue(report.groupNumber));
  }, [reports]);

  const availableGroupNumbers = useMemo(() => {
    const groupSet = new Set();

    groups.forEach((group) => {
      const value = Number(group.groupNumber);

      if (Number.isInteger(value) && value > 0) {
        groupSet.add(value);
      }
    });

    reports.forEach((report) => {
      const value = Number(report.groupNumber);

      if (Number.isInteger(value) && value > 0) {
        groupSet.add(value);
      }
    });

    periods.forEach((period) => {
      const value = Number(period.groupNumber);

      if (Number.isInteger(value) && value > 0) {
        groupSet.add(value);
      }
    });

    if (defaultAdminGroupNumber) {
      const value = Number(defaultAdminGroupNumber);

      if (Number.isInteger(value) && value > 0) {
        groupSet.add(value);
      }
    }

    return Array.from(groupSet).sort((a, b) => a - b);
  }, [defaultAdminGroupNumber, groups, periods, reports]);
  const activeGroupIsUngrouped = useMemo(() => {
    if (!isSuperAdmin) {
      return false;
    }

    if (selectedGroupNumber === "ungrouped") {
      return hasUngroupedReports;
    }

    if (!selectedGroupNumber && 0 === availableGroupNumbers.length && hasUngroupedReports) {
      return true;
    }

    return false;
  }, [
    availableGroupNumbers.length,
    hasUngroupedReports,
    isSuperAdmin,
    selectedGroupNumber,
  ]);

  const activeGroupNumber = useMemo(() => {
    if (!isSuperAdmin) {
      const ownGroup = Number(defaultAdminGroupNumber);
      return Number.isInteger(ownGroup) && ownGroup > 0 ? ownGroup : null;
    }

    if (activeGroupIsUngrouped) {
      return null;
    }

    const selectedValue = Number(selectedGroupNumber);

    if (
      Number.isInteger(selectedValue) &&
      selectedValue > 0 &&
      availableGroupNumbers.includes(selectedValue)
    ) {
      return selectedValue;
    }

    return availableGroupNumbers[0] || null;
  }, [
    activeGroupIsUngrouped,
    availableGroupNumbers,
    defaultAdminGroupNumber,
    isSuperAdmin,
    selectedGroupNumber,
  ]);

  const activeGroupLabel = useMemo(() => {
    if (activeGroupIsUngrouped) {
      return "Sin grupo";
    }

    if (activeGroupNumber === null) {
      return "Sin grupo";
    }

    const matchedGroup = groups.find(
      (group) => Number(group.groupNumber) === Number(activeGroupNumber)
    );

    return matchedGroup?.name || `Grupo ${activeGroupNumber}`;
  }, [activeGroupIsUngrouped, activeGroupNumber, groups]);
  const groupTabs = useMemo(() => {
    if (isSuperAdmin) {
      const tabs = availableGroupNumbers.map((groupNumber) => {
        const matchedGroup = groups.find(
          (group) => Number(group.groupNumber) === Number(groupNumber)
        );
        const groupName = matchedGroup?.name || `Grupo ${groupNumber}`;

        return {
          key: `group-${groupNumber}`,
          value: String(groupNumber),
          label: `${groupName} (Grupo ${groupNumber})`,
          isActive: Number(activeGroupNumber) === Number(groupNumber) && !activeGroupIsUngrouped,
          isDisabled: false,
        };
      });

      if (hasUngroupedReports) {
        tabs.unshift({
          key: "group-ungrouped",
          value: "ungrouped",
          label: "Sin grupo",
          isActive: activeGroupIsUngrouped,
          isDisabled: false,
        });
      }

      return tabs;
    }

    if (activeGroupNumber !== null) {
      return [
        {
          key: `group-${activeGroupNumber}`,
          value: String(activeGroupNumber),
          label: `${activeGroupLabel} (Grupo ${activeGroupNumber})`,
          isActive: true,
          isDisabled: true,
        },
      ];
    }

    return [];
  }, [
    activeGroupIsUngrouped,
    activeGroupLabel,
    activeGroupNumber,
    availableGroupNumbers,
    groups,
    hasUngroupedReports,
    isSuperAdmin,
  ]);
  const activeGroupViewKey = useMemo(() => {
    if (activeGroupIsUngrouped) {
      return "ungrouped";
    }

    if (activeGroupNumber !== null) {
      return `group-${activeGroupNumber}`;
    }

    return "group-none";
  }, [activeGroupIsUngrouped, activeGroupNumber]);

  const reportsForActiveGroup = useMemo(() => {
    if (activeGroupIsUngrouped) {
      return reports.filter((report) => hasMissingGroupValue(report.groupNumber));
    }

    if (activeGroupNumber === null) {
      return [];
    }

    return reports.filter(
      (report) => Number(report.groupNumber) === Number(activeGroupNumber)
    );
  }, [activeGroupIsUngrouped, activeGroupNumber, reports]);

  const closedPeriods = useMemo(() => {
    if (activeGroupIsUngrouped || activeGroupNumber === null) {
      return [];
    }

    return (periods || [])
      .filter(
        (period) =>
          true === period.isClosed &&
          Number(period.groupNumber) === Number(activeGroupNumber)
      )
      .sort((a, b) => b.reportMonthKey.localeCompare(a.reportMonthKey));
  }, [activeGroupIsUngrouped, activeGroupNumber, periods]);

  const closedMonthKeys = useMemo(() => {
    return closedPeriods.map((period) => period.reportMonthKey).filter(Boolean);
  }, [closedPeriods]);

  const reportMonthKeys = useMemo(() => {
    return Array.from(
      new Set(reportsForActiveGroup.map((report) => report.reportMonthKey).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
  }, [reportsForActiveGroup]);

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

  const filteredReports = useMemo(() => {
    return reportsForActiveGroup.filter(
      (report) => report.reportMonthKey === activeMonthKey
    );
  }, [reportsForActiveGroup, activeMonthKey]);
  const isActiveMonthClosed = useMemo(() => {
    return closedMonthKeySet.has(activeMonthKey);
  }, [activeMonthKey, closedMonthKeySet]);

  const peopleForActiveGroup = useMemo(() => {
    if (activeGroupIsUngrouped || activeGroupNumber === null) {
      return [];
    }

    return people.filter((person) => Number(person.groupNumber) === Number(activeGroupNumber));
  }, [activeGroupIsUngrouped, activeGroupNumber, people]);
  const getCompletionPercent = (totalReports) => {
    const totalPeople = peopleForActiveGroup.length;

    if (totalPeople < 1) {
      return 0;
    }

    const reportsCount = Number(totalReports) || 0;
    const rawPercent = (reportsCount / totalPeople) * 100;
    const normalizedPercent = Math.round(rawPercent);

    if (normalizedPercent < 0) {
      return 0;
    }

    if (normalizedPercent > 100) {
      return 100;
    }

    return normalizedPercent;
  };

  const reportSummaryByMonth = useMemo(() => {
    const summary = new Map();

    reportsForActiveGroup.forEach((report) => {
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
  }, [reportsForActiveGroup]);

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
      new Set(reportsForActiveGroup.map((report) => report.reportMonthKey).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
    return keys.slice(0, statsRange).reverse();
  }, [reportsForActiveGroup, statsRange]);

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

    reportsForActiveGroup.forEach((report) => {
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
  }, [reportsForActiveGroup, lastMonthKeys]);

  const currentMonthStats = useMemo(() => {
    let totalReports = 0;
    let totalHours = 0;
    let totalCourses = 0;
    let precursors = 0;

    filteredReports.forEach((r) => {
      totalReports += 1;
      const h = Number.parseFloat(r.hours);
      const c = Number.parseFloat(r.courses);
      if (!Number.isNaN(h)) totalHours += h;
      if (!Number.isNaN(c)) totalCourses += c;
      if (r.designation === "Precursor Auxiliar" || r.designation === "Precursor Regular") {
        precursors += 1;
      }
    });

    return { totalReports, totalHours, totalCourses, precursors };
  }, [filteredReports]);

  const updateAdminForm = (field, value) => {
    setAdminForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetAdminForm = (monthKey) => {
    setAdminForm(
      buildDefaultAdminForm(
        monthKey,
        activeGroupNumber !== null ? String(activeGroupNumber) : defaultAdminGroupNumber
      )
    );
    setEditingId(null);
    setFormErrors({});
  };

  const openNewModal = () => {
    if (activeGroupIsUngrouped) {
      setSubmitStatus("error");
      setSubmitMessage("Los informes sin grupo son solo de consulta.");
      return;
    }

    if (activeGroupNumber === null) {
      setSubmitStatus("error");
      setSubmitMessage("Seleccione un grupo para agregar informes.");
      return;
    }

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

    if (canReassignGroupOnEdit) {
      if (
        adminForm.groupNumber === "" ||
        Number.isNaN(Number(adminForm.groupNumber)) ||
        Number(adminForm.groupNumber) < 1
      ) {
        nextErrors.groupNumber = "Seleccione un grupo válido.";
      }
    } else if (activeGroupNumber === null) {
      nextErrors.groupNumber = "Seleccione un grupo válido.";
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

      if ("Forbidden" === apiError) {
        return "No tiene permisos para realizar esta acción.";
      }

      return apiError || fallbackMessage;
    } catch (error) {
      return fallbackMessage;
    }
  };

  const loadReports = async ({ forceRefresh = false } = {}) => {
    if (!isAuthenticated) {
      return;
    }

    const cacheKey = authUser?.username;

    if (!forceRefresh && _adminCache && _adminCache.username === cacheKey && _adminCache.reports) {
      setReports(_adminCache.reports);
      setPeriods(_adminCache.periods || []);
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/reports");

      if (response.status === 401) {
        onLogout();
        setLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load reports");
      }

      const data = await response.json();
      const nextReports = data.items || [];
      const nextPeriods = data.periods || [];
      setReports(nextReports);
      setPeriods(nextPeriods);
      _adminCache = { ..._adminCache, username: cacheKey, reports: nextReports, periods: nextPeriods };
    } catch (error) {
      setLoadError("No se pudieron cargar los registros.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestConfirmation = ({
    title = "Confirmar acción",
    message = "",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
      });
      setConfirmResolver(() => resolve);
    });
  };

  const closeConfirmation = (result) => {
    if (confirmResolver) {
      confirmResolver(Boolean(result));
    }

    setConfirmResolver(null);
    setConfirmState((previous) => ({
      ...previous,
      isOpen: false,
    }));
  };

  const loadPeople = async ({ forceRefresh = false } = {}) => {
    if (!isAuthenticated) {
      return;
    }

    const cacheKey = authUser?.username;

    if (!forceRefresh && _adminCache && _adminCache.username === cacheKey && _adminCache.people) {
      setPeople(_adminCache.people);
      return;
    }

    setPendingError("");

    try {
      const response = await fetch("/api/people");

      if (response.status === 401) {
        onLogout();
        setPendingError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load people");
      }

      const data = await response.json();
      const nextPeople = data.items || [];
      setPeople(nextPeople);
      setPendingError("");
      _adminCache = { ..._adminCache, username: cacheKey, people: nextPeople };
    } catch (error) {
      setPendingError("No se pudieron cargar las personas.");
    }
  };

  const loadGroups = async ({ forceRefresh = false } = {}) => {
    if (!isAuthenticated) {
      return;
    }

    const cacheKey = authUser?.username;

    if (!forceRefresh && _adminCache && _adminCache.username === cacheKey && _adminCache.groups) {
      setGroups(_adminCache.groups);
      return;
    }

    try {
      const response = await fetch("/api/groups");

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load groups");
      }

      const data = await response.json();
      const nextGroups = data.items || [];
      setGroups(nextGroups);
      _adminCache = { ..._adminCache, username: cacheKey, groups: nextGroups };
    } catch (error) {
      setGroups([]);
    }
  };

  useEffect(() => {
    loadReports();
    loadPeople();
    loadGroups();
  }, [authToken]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedGroupNumber(defaultAdminGroupNumber || "");
      return;
    }

    if (selectedGroupNumber === "ungrouped") {
      if (hasUngroupedReports) {
        return;
      }
    } else if (isValidGroupNumberValue(selectedGroupNumber)) {
      if (availableGroupNumbers.includes(Number(selectedGroupNumber))) {
        return;
      }
    }

    if (availableGroupNumbers.length > 0) {
      setSelectedGroupNumber(String(availableGroupNumbers[0]));
      return;
    }

    if (hasUngroupedReports) {
      setSelectedGroupNumber("ungrouped");
      return;
    }

    if (selectedGroupNumber !== "") {
      setSelectedGroupNumber("");
    }
  }, [
    availableGroupNumbers,
    defaultAdminGroupNumber,
    hasUngroupedReports,
    isSuperAdmin,
    selectedGroupNumber,
  ]);

  useEffect(() => {
    if (editingId) {
      return;
    }

    setAdminForm((previous) => ({
      ...previous,
      groupNumber:
        activeGroupNumber !== null
          ? String(activeGroupNumber)
          : previous.groupNumber || defaultAdminGroupNumber,
    }));
  }, [activeGroupNumber, defaultAdminGroupNumber, editingId]);

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

  const handleGroupTabSelect = (value) => {
    if (!isSuperAdmin) {
      return;
    }

    setSelectedGroupNumber(String(value || ""));
  };

  const handleClosePeriod = async () => {
    if (!canClosePeriod) {
      setSubmitStatus("error");
      setSubmitMessage(
        closePeriodBlockReason || "No se puede cerrar el periodo seleccionado."
      );
      return;
    }

    const isConfirmed = await requestConfirmation({
      title: "Cerrar periodo",
      message: closePeriodConfirmMessage,
      confirmLabel: "Cerrar periodo",
    });

    if (!isConfirmed) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "closePeriod",
          reportMonthKey: activeMonthKey,
          groupNumber: activeGroupNumber,
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
      await loadReports({ forceRefresh: true });
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

    const isConfirmed = await requestConfirmation({
      title: "Reabrir periodo",
      message: `¿Desea reabrir el periodo de ${activeMonthLabel} para ${activeGroupLabel}? El mes volverá a estar habilitado para edición.`,
      confirmLabel: "Reabrir periodo",
    });

    if (!isConfirmed) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reopenPeriod",
          reportMonthKey: activeMonthKey,
          groupNumber: activeGroupNumber,
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
      await loadReports({ forceRefresh: true });
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo reabrir el periodo."));
    }
  };

  const normalizeName = (value) => {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Divide un nombre normalizado en palabras individuales
  const getTokens = (name) =>
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 0);

  // Un token "o" hace match con "obando" (inicial), y viceversa
  const tokenMatches = (a, b) => {
    if (a === b) return true;
    if (a.length === 1 && b.startsWith(a)) return true;
    if (b.length === 1 && a.startsWith(b)) return true;
    return false;
  };

  // Verifica si todos los tokens de 'source' están presentes en 'target'
  const allTokensFoundIn = (sourceTokens, targetTokens) =>
    sourceTokens.every((st) => targetTokens.some((tt) => tokenMatches(st, tt)));

  // Matching flexible: funciona si el nombre de la BD está contenido en el enviado
  // o si el nombre enviado está contenido en el de la BD (con soporte de iniciales)
  const namesMatch = (dbName, submittedName) => {
    const dbTokens = getTokens(dbName);
    const subTokens = getTokens(submittedName);
    if (!dbTokens.length || !subTokens.length) return false;
    return (
      allTokensFoundIn(dbTokens, subTokens) ||
      allTokensFoundIn(subTokens, dbTokens)
    );
  };

  const pendingPeople = useMemo(() => {
    return peopleForActiveGroup.filter((person) => {
      const personName = person.name || "";
      if (!normalizeName(personName)) return false;
      return !filteredReports.some((report) =>
        namesMatch(personName, report.name || "")
      );
    });
  }, [filteredReports, peopleForActiveGroup]);
  const shouldValidatePendingPeople = activeMonthKey === defaultMonthKey;

  const closePeriodBlockReason = useMemo(() => {
    if (activeGroupIsUngrouped) {
      return "Los informes sin grupo no admiten cierre de periodo.";
    }

    if (activeGroupNumber === null) {
      return "Seleccione un grupo para gestionar periodos.";
    }

    if (isActiveMonthClosed) {
      return "Este periodo ya está completado.";
    }

    if (0 === filteredReports.length) {
      return "No hay informes cargados para este mes.";
    }

    return "";
  }, [
    activeGroupIsUngrouped,
    activeGroupNumber,
    filteredReports.length,
    isActiveMonthClosed,
  ]);

  const canClosePeriod = "" === closePeriodBlockReason;
  const closePeriodConfirmMessage = useMemo(() => {
    const defaultMessage = `¿Desea cerrar el periodo de ${activeMonthLabel} para ${activeGroupLabel}? El mes quedará en modo solo vista previa.`;

    if (!shouldValidatePendingPeople) {
      return defaultMessage;
    }

    if (pendingError) {
      return `${defaultMessage}\n\nNo se pudo validar la lista de pendientes. ¿Desea continuar de todos modos?`;
    }

    if (0 === peopleForActiveGroup.length) {
      return `${defaultMessage}\n\nNo hay personas registradas para comparar pendientes. ¿Desea continuar de todos modos?`;
    }

    if (0 < pendingPeople.length) {
      return `${defaultMessage}\n\nAún hay ${pendingPeople.length} persona(s) pendiente(s) por informar. ¿Desea cerrar el periodo de todos modos?`;
    }

    return defaultMessage;
  }, [
    activeGroupLabel,
    activeMonthLabel,
    pendingError,
    pendingPeople.length,
    peopleForActiveGroup.length,
    shouldValidatePendingPeople,
  ]);
  const reopenPeriodBlockReason = useMemo(() => {
    if (activeGroupIsUngrouped) {
      return "Los informes sin grupo no admiten reapertura de periodo.";
    }

    if (activeGroupNumber === null) {
      return "Seleccione un grupo para gestionar periodos.";
    }

    if (!isActiveMonthClosed) {
      return "Este periodo ya está abierto.";
    }

    return "";
  }, [activeGroupIsUngrouped, activeGroupNumber, isActiveMonthClosed]);
  const canReopenPeriod = "" === reopenPeriodBlockReason;

  const handleDownloadPdf = () => {
    const monthKey = activeMonthKey;
    const monthLabel = activeMonthLabel;
    const monthReports = reportsForActiveGroup.filter(
      (report) => report.reportMonthKey === monthKey
    );

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
      document.text(`Informes ${activeGroupLabel}`, marginX, marginY);
      const monthWidth = document.getTextWidth(monthLabel);
      document.text(monthLabel, pageWidth - marginX - monthWidth, marginY);

      document.setFillColor(90, 90, 90);
      document.rect(marginX, marginY + 20, tableWidth, headerBarHeight, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(12);
      document.setTextColor(255, 255, 255);
      const title = `INFORMES ${activeGroupLabel.toUpperCase()} / MES: ${monthLabel.toUpperCase()}`;
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

    const safeGroupLabel = activeGroupLabel
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    document.save(`informes-${safeGroupLabel}-${monthKey}.pdf`);
  };

  const openTrash = async () => {
    setIsTrashOpen(true);
    setIsLoadingTrash(true);
    try {
      const response = await fetch("/api/reports?deleted=true");
      if (!response.ok) throw new Error("No se pudo cargar la papelera.");
      const data = await response.json();
      setDeletedReports(data.items || []);
    } catch {
      setDeletedReports([]);
    } finally {
      setIsLoadingTrash(false);
    }
  };

  const handleRestore = async (reportId) => {
    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) throw new Error("No se pudo restaurar el registro.");
      setDeletedReports((prev) => prev.filter((r) => r.id !== reportId));
      await loadReports({ forceRefresh: true });
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "Error al restaurar."));
    }
  };

  const handlePermanentDelete = async (reportId) => {
    const isConfirmed = await requestConfirmation({
      title: "Eliminar permanentemente",
      message: "Esta acción no se puede deshacer. ¿Desea eliminar este registro de forma definitiva?",
      confirmLabel: "Eliminar definitivamente",
    });
    if (!isConfirmed) return;
    try {
      const response = await fetch(`/api/reports?id=${reportId}&permanent=true`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("No se pudo eliminar el registro.");
      setDeletedReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "Error al eliminar."));
    }
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
      groupNumber:
        report.groupNumber !== null && report.groupNumber !== undefined
          ? String(report.groupNumber)
          : activeGroupNumber !== null
          ? String(activeGroupNumber)
          : defaultAdminGroupNumber,
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

    const isConfirmed = await requestConfirmation({
      title: "Eliminar registro",
      message: "¿Desea eliminar este registro?",
      confirmLabel: "Eliminar",
    });

    if (!isConfirmed) {
      return;
    }

    setSubmitMessage("");
    setSubmitStatus("loading");

    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: "DELETE",
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
      setSubmitMessage("El registro fue enviado a la papelera.");
      await loadReports({ forceRefresh: true });
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo eliminar el registro."));
    }
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (activeGroupIsUngrouped && !canReassignGroupOnEdit) {
      setSubmitStatus("error");
      setSubmitMessage("Los informes sin grupo son solo de consulta.");
      return;
    }

    if (activeGroupNumber === null && !canReassignGroupOnEdit) {
      setSubmitStatus("error");
      setSubmitMessage("Seleccione un grupo para guardar informes.");
      return;
    }

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
      groupNumber: canReassignGroupOnEdit
        ? Number(adminForm.groupNumber)
        : Number(activeGroupNumber),
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
      await loadReports({ forceRefresh: true });
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
          <p className="brand brand-with-icon">
            <span className="brand-icon" aria-hidden="true">
              <AdminSectionIcon />
            </span>
            <span>Panel administrativo</span>
          </p>
          <h1 className="title">Registros de informes</h1>
        </div>
        <div className="admin-header-actions">
          <button className="trash-button" type="button" onClick={openTrash}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Papelera
          </button>
        </div>
      </div>

      {!isDetailView && (activeGroupNumber !== null || activeGroupIsUngrouped) && (
        <div className="stats-summary-row">
          <div className="stat-summary-card">
            <div className="stat-summary-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </div>
            {isLoading ? (
              <span className="skeleton-line skeleton-md stat-summary-skeleton" />
            ) : (
              <span className="stat-summary-value">{currentMonthStats.totalReports}</span>
            )}
            <span className="stat-summary-label">Informes</span>
          </div>
          <div className="stat-summary-card">
            <div className="stat-summary-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            {isLoading ? (
              <span className="skeleton-line skeleton-md stat-summary-skeleton" />
            ) : (
              <span className="stat-summary-value">{currentMonthStats.totalCourses}</span>
            )}
            <span className="stat-summary-label">Cursos</span>
          </div>
          <div className="stat-summary-card">
            <div className="stat-summary-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            {isLoading ? (
              <span className="skeleton-line skeleton-md stat-summary-skeleton" />
            ) : (
              <span className="stat-summary-value">{currentMonthStats.precursors}</span>
            )}
            <span className="stat-summary-label">Precursores</span>
          </div>
        </div>
      )}

      <div className="admin-group-shell">
        <div className="admin-group-tabs" role="tablist" aria-label="Grupos de informes">
          {0 === groupTabs.length ? (
            <button className="admin-group-tab" type="button" disabled>
              Sin grupos disponibles
            </button>
          ) : (
            groupTabs.map((tab) => (
              <button
                key={tab.key}
                className={`admin-group-tab ${tab.isActive ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={tab.isActive}
                onClick={() => handleGroupTabSelect(tab.value)}
                disabled={tab.isDisabled}
              >
                {tab.label}
              </button>
            ))
          )}
        </div>

        <section className="admin-group-panel">
          <div key={activeGroupViewKey} className="admin-group-content">
        {!isDetailView ? (
          <>
            <section className="closed-periods">
              <div className="closed-periods-header">
                <h2 className="closed-periods-title">Periodo abierto</h2>
                {isLoading || 0 < openPeriodSummaries.length ? (
                  <p className="closed-periods-subtitle">
                    {activeGroupLabel}: seleccione un periodo abierto para registrar o editar
                    informes.
                  </p>
                ) : null}
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
                  : null}
                {!isLoading && 0 === openPeriodSummaries.length ? (
                  <div className="closed-period-item closed-period-item-skeleton">
                    <span className="closed-period-meta">
                      No hay periodo abierto.
                    </span>
                  </div>
                ) : null}
                {!isLoading
                  ? openPeriodSummaries.map((period) => (
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
                        <span className="closed-period-month">
                          <span className="closed-period-icon" aria-hidden="true">
                            <CalendarIcon />
                          </span>
                          <span>{period.reportMonthLabel}</span>
                        </span>
                        <span className="closed-period-meta">
                          Completado: {getCompletionPercent(period.totalReports)}%
                        </span>
                        <span className="closed-period-meta">
                          <span className="closed-period-icon status-open" aria-hidden="true">
                            <OpenLockIcon />
                          </span>
                          <span>Estado: abierto</span>
                        </span>
                      </button>
                    ))
                  : null}
              </div>
            </section>

            <section className="closed-periods">
              <div className="closed-periods-header">
                <h2 className="closed-periods-title">Meses completados</h2>
                <p className="closed-periods-subtitle">
                  {activeGroupLabel}: seleccione un mes para abrir sus detalles.
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
                        <span className="closed-period-month">
                          <span className="closed-period-icon" aria-hidden="true">
                            <CalendarIcon />
                          </span>
                          <span>{period.reportMonthLabel}</span>
                        </span>
                        <span className="closed-period-meta">
                          Completado: {getCompletionPercent(period.totalReports)}%
                        </span>
                        <span className="closed-period-meta">
                          <span className="closed-period-icon status-completed" aria-hidden="true">
                            <CheckCircleIcon />
                          </span>
                          <span>Completado: {formatDateTime(period.closedAt)}</span>
                        </span>
                      </button>
                    ))
                  : null}
              </div>
            </section>
          </>
        ) : null}

        {isDetailView ? (
          <div id="month-details">
            <AdminMonthDetailView
              activeGroupLabel={activeGroupLabel}
              activeMonthLabel={activeMonthLabel}
              canClosePeriod={canClosePeriod}
              canReopenPeriod={canReopenPeriod}
              canDownloadPdf={filteredReports.length > 0}
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
          </div>
        </section>
      </div>

      {isTrashOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Papelera">
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <p className="brand">Informes eliminados</p>
                <h2 className="modal-title">Papelera</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setIsTrashOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              {isLoadingTrash ? (
                <div style={{ padding: "24px 0" }}>
                  <span className="skeleton-line skeleton-xl" />
                  <span className="skeleton-line skeleton-lg" style={{ marginTop: 10 }} />
                  <span className="skeleton-line skeleton-md" style={{ marginTop: 10 }} />
                </div>
              ) : deletedReports.length === 0 ? (
                <p className="subtitle" style={{ textAlign: "center", padding: "24px 0" }}>
                  La papelera está vacía.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Mes</th>
                        <th>Grupo</th>
                        <th>Eliminado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedReports.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.reportMonthLabel || r.reportMonthKey}</td>
                          <td>{r.groupNumber ? `Grupo ${r.groupNumber}` : "—"}</td>
                          <td>{r.deletedAt ? formatDateTime(r.deletedAt) : "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                className="restore-button"
                                type="button"
                                onClick={() => handleRestore(r.id)}
                              >
                                Restaurar
                              </button>
                              <button
                                className="table-button danger"
                                type="button"
                                onClick={() => handlePermanentDelete(r.id)}
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
              )}
            </div>
          </div>
        </div>
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

              {canReassignGroupOnEdit ? (
                <div className="field">
                  <label htmlFor="admin-group">
                    Grupo del registro <span className="required">*</span>
                  </label>
                  <select
                    id="admin-group"
                    name="admin-group"
                    value={adminForm.groupNumber}
                    onChange={(event) =>
                      updateAdminForm("groupNumber", event.target.value)
                    }
                    aria-invalid={Boolean(formErrors.groupNumber)}
                    aria-describedby={formErrors.groupNumber ? "group-error" : undefined}
                    required
                  >
                    <option value="">Seleccione</option>
                    {groups.map((group) => (
                      <option key={group.groupNumber} value={group.groupNumber}>
                        {group.name || `Grupo ${group.groupNumber}`} (Grupo {group.groupNumber})
                      </option>
                    ))}
                  </select>
                  {formErrors.groupNumber ? (
                    <span id="group-error" className="error">
                      {formErrors.groupNumber}
                    </span>
                  ) : null}
                </div>
              ) : (
                <>
                  <input
                    type="hidden"
                    name="admin-group"
                    value={activeGroupNumber !== null ? String(activeGroupNumber) : ""}
                  />

                  <p className="config-section-description">
                    Grupo asignado: <strong>{activeGroupLabel}</strong>
                  </p>
                </>
              )}

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
              {!pendingError && peopleForActiveGroup.length === 0 ? (
                <p className="subtitle">
                  No hay personas registradas en {activeGroupLabel} para comparar.
                </p>
              ) : null}
              {!pendingError && peopleForActiveGroup.length > 0 ? (
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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={() => closeConfirmation(true)}
        onCancel={() => closeConfirmation(false)}
      />
    </section>
  );
}

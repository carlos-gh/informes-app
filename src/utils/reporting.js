export const getReportDate = (currentDate) => {
  return new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
};

export const getMonthNameInSpanish = (date) => {
  return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(date);
};

export const getReportingLabel = (date) => {
  const monthName = getMonthNameInSpanish(date);
  const year = date.getFullYear();
  return `${monthName} ${year}`;
};

export const getReportMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const getReportDateFromKey = (monthKey) => {
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

export const getReportingLabelFromKey = (monthKey) => {
  const date = getReportDateFromKey(monthKey);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
    date
  );
};

export const isFormWindowOpen = (currentDate, formOpenDays = 10) => {
  const dayOfMonth = currentDate.getDate();
  const parsedDays = Number(formOpenDays);
  const safeDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 10;

  return dayOfMonth >= 1 && dayOfMonth <= safeDays;
};

export const isNumericValue = (value) => {
  return value.trim() === "" || !Number.isNaN(Number(value));
};

export const formatDateTime = (value) => {
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

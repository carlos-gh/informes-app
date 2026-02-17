import { formatDateTime } from "../utils/reporting.js";

const NewReportIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M12 11v6M9 14h6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ReopenPeriodIcon = () => (
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

const ClosePeriodIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PendingIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9 11h8M9 15h5M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-.5 7.5h.01M6.5 14.5h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StatsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 20h16M7 20v-6m5 6V9m5 11v-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PdfIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 14h1.5a1.5 1.5 0 0 1 0 3H9Zm4 3v-3h1.4a1.6 1.6 0 0 1 0 3Zm0 0h1.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ADMIN_TABLE_SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => index);
const ADMIN_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-xs",
  "skeleton-xs",
  "skeleton-xl",
  "skeleton-md",
  "skeleton-sm",
  "skeleton-md",
];

export default function AdminMonthDetailView({
  activeGroupLabel,
  activeMonthLabel,
  canClosePeriod,
  canReopenPeriod,
  canDownloadPdf,
  closePeriodBlockReason,
  reopenPeriodBlockReason,
  filteredReports,
  isActiveMonthClosed,
  isSubmitting,
  isLoading,
  loadError,
  onBack,
  onClosePeriod,
  onReopenPeriod,
  onEdit,
  onDelete,
  onDownloadPdf,
  onOpenNewModal,
  onOpenPending,
  onOpenStats,
}) {
  return (
    <section className="admin-detail">
      <div className="admin-toolbar admin-detail-toolbar">
        <div className="admin-toolbar-left admin-detail-left">
          <button className="secondary-button" type="button" onClick={onBack}>
            Volver al resumen
          </button>
          <span className="month-caption">
            Detalle del mes: {activeMonthLabel} · {activeGroupLabel}
            {isActiveMonthClosed ? " (completado)" : ""}
          </span>
        </div>
        <div className="admin-toolbar-right">
          <button
            className="secondary-button action-button"
            type="button"
            onClick={onOpenNewModal}
            disabled={isActiveMonthClosed}
          >
            <span className="action-button-icon" aria-hidden="true">
              <NewReportIcon />
            </span>
            <span>Nuevo registro</span>
          </button>
          <button
            className="secondary-button action-button"
            type="button"
            onClick={isActiveMonthClosed ? onReopenPeriod : onClosePeriod}
            disabled={
              isActiveMonthClosed
                ? !canReopenPeriod || isSubmitting
                : !canClosePeriod || isSubmitting
            }
            title={
              isActiveMonthClosed
                ? reopenPeriodBlockReason || undefined
                : closePeriodBlockReason || undefined
            }
          >
            <span className="action-button-icon" aria-hidden="true">
              {isActiveMonthClosed ? <ReopenPeriodIcon /> : <ClosePeriodIcon />}
            </span>
            <span>{isActiveMonthClosed ? "Reabrir periodo" : "Cerrar periodo"}</span>
          </button>
          <button
            className="secondary-button action-button"
            type="button"
            onClick={onOpenPending}
          >
            <span className="action-button-icon" aria-hidden="true">
              <PendingIcon />
            </span>
            <span>Pendientes</span>
          </button>
          <button className="secondary-button action-button" type="button" onClick={onOpenStats}>
            <span className="action-button-icon" aria-hidden="true">
              <StatsIcon />
            </span>
            <span>Estadísticas</span>
          </button>
          <button
            className="secondary-button action-button"
            type="button"
            onClick={onDownloadPdf}
            disabled={!canDownloadPdf}
          >
            <span className="action-button-icon" aria-hidden="true">
              <PdfIcon />
            </span>
            <span>Generar PDF</span>
          </button>
        </div>
      </div>

      {isActiveMonthClosed ? (
        <div className="preview-notice">
          Este periodo está completado. Los registros se muestran en modo solo vista
          previa.
        </div>
      ) : null}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>No.</th>
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
            {isLoading
              ? ADMIN_TABLE_SKELETON_ROWS.map((rowIndex) => (
                  <tr key={`admin-skeleton-${rowIndex}`} className="table-skeleton">
                    {ADMIN_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                      <td key={`admin-skeleton-cell-${rowIndex}-${cellIndex}`}>
                        <span className={`skeleton-line ${size}`} />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && loadError ? (
              <tr>
                <td colSpan={9}>{loadError}</td>
              </tr>
            ) : null}
            {!isLoading && !loadError && filteredReports.length === 0 ? (
              <tr>
                <td colSpan={9}>No hay registros disponibles.</td>
              </tr>
            ) : null}
            {!isLoading &&
              !loadError &&
              filteredReports.map((report, index) => (
                <tr key={report.id}>
                  <td>{index + 1}</td>
                  <td>{report.name}</td>
                  <td>{report.participation}</td>
                  <td>{report.hours || "-"}</td>
                  <td>{report.courses || "-"}</td>
                  <td>{report.comments || "-"}</td>
                  <td>{formatDateTime(report.submittedAt)}</td>
                  <td>{report.designation || "Publicador"}</td>
                  <td>
                    {isActiveMonthClosed ? (
                      <span className="table-preview-tag">Solo vista previa</span>
                    ) : (
                      <div className="table-actions">
                        <button
                          className="table-button"
                          type="button"
                          onClick={() => onEdit(report)}
                        >
                          Editar
                        </button>
                        <button
                          className="table-button danger"
                          type="button"
                          onClick={() => onDelete(report.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

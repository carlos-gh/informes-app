import { formatDateTime } from "../utils/reporting.js";

const ADMIN_TABLE_SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => index);
const ADMIN_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-sm",
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
            Detalle del mes: {activeMonthLabel}
            {isActiveMonthClosed ? " (completado)" : ""}
          </span>
        </div>
        <div className="admin-toolbar-right">
          <button
            className="secondary-button"
            type="button"
            onClick={onOpenNewModal}
            disabled={isActiveMonthClosed}
          >
            Nuevo registro
          </button>
          <button
            className="secondary-button"
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
            {isActiveMonthClosed ? "Reabrir periodo" : "Cerrar periodo"}
          </button>
          <button className="secondary-button" type="button" onClick={onOpenPending}>
            Pendientes
          </button>
          <button className="secondary-button" type="button" onClick={onOpenStats}>
            Estadísticas
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onDownloadPdf}
            disabled={!canDownloadPdf}
          >
            Generar PDF
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

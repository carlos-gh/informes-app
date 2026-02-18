const clampPage = (value, totalPages) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return 1;
  }

  if (parsedValue > totalPages) {
    return totalPages;
  }

  return parsedValue;
};

const buildPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis-start");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);

  return items;
};

export default function Pagination({
  totalItems = 0,
  pageSize = 10,
  currentPage = 1,
  onPageChange = () => {},
  ariaLabel = "Paginación",
  className = "",
}) {
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  const safeCurrentPage = clampPage(currentPage, totalPages);

  if (safeTotalItems <= safePageSize) {
    return null;
  }

  const startItem = (safeCurrentPage - 1) * safePageSize + 1;
  const endItem = Math.min(safeCurrentPage * safePageSize, safeTotalItems);
  const pageItems = buildPageItems(safeCurrentPage, totalPages);

  const handlePageChange = (nextPage) => {
    const safeNextPage = clampPage(nextPage, totalPages);

    if (safeNextPage === safeCurrentPage) {
      return;
    }

    onPageChange(safeNextPage);
  };

  return (
    <nav className={`pagination ${className}`.trim()} aria-label={ariaLabel}>
      <span className="pagination-info">
        Mostrando {startItem}-{endItem} de {safeTotalItems}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-button"
          type="button"
          onClick={() => handlePageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
        >
          Anterior
        </button>
        {pageItems.map((item, index) => {
          if ("number" !== typeof item) {
            return (
              <span
                key={`pagination-ellipsis-${index + 1}`}
                className="pagination-ellipsis"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          return (
            <button
              key={`pagination-page-${item}`}
              className={`pagination-button ${safeCurrentPage === item ? "active" : ""}`}
              type="button"
              onClick={() => handlePageChange(item)}
              aria-current={safeCurrentPage === item ? "page" : undefined}
            >
              {item}
            </button>
          );
        })}
        <button
          className="pagination-button"
          type="button"
          onClick={() => handlePageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}

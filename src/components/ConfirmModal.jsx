import { useEffect } from "react";

export default function ConfirmModal({
  isOpen = false,
  title = "Confirmar acción",
  message = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm = () => {},
  onCancel = () => {},
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div
        className="modal modal-confirm"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" type="button" onClick={onCancel}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="form-actions confirm-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className="submit" type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

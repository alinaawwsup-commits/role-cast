function Modal({ isOpen, onClose, children, panelClassName, closeOnOverlay = true }) {
  if (!isOpen) return null;

  const panelClass = ["modal", panelClassName].filter(Boolean).join(" ");

  return (
    <div className="modal-root">
      <div className="modal-overlay" onClick={closeOnOverlay ? onClose : undefined} />
      <section className={panelClass} onClick={(event) => event.stopPropagation()}>
        {children}
      </section>
    </div>
  );
}

export default Modal;

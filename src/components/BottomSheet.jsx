function BottomSheet({ isOpen, onClose, title, children }) {
  return (
    <div className={`bottom-sheet-root ${isOpen ? "open" : ""}`}>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <section className="bottom-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <h3 className="bottom-sheet-title">{title}</h3>
        <div className="bottom-sheet-content">{children}</div>
      </section>
    </div>
  );
}

export default BottomSheet;

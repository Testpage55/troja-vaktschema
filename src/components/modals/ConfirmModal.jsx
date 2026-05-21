export default function ConfirmModal({
  isOpen, onClose, onConfirm,
  title, message,
  confirmText = 'Ta bort',
  confirmButtonClass = 'btn-danger'
}) {
  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px'
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', borderRadius: '15px',
          width: '100%', maxWidth: '450px', overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }}
      >
        <div
          className="modal-header"
          style={{ backgroundColor: '#fef2f2', padding: '25px 30px 20px', borderBottom: '1px solid #fecaca' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '48px', height: '48px', backgroundColor: '#fca5a5',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '24px'
            }}>
              ⚠️
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#991b1b' }}>
              {title}
            </h2>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '25px 30px', color: '#374151', lineHeight: '1.6' }}>
          <div style={{ whiteSpace: 'pre-line', fontSize: '16px' }}>{message}</div>
        </div>

        <div
          className="modal-footer"
          style={{ padding: '20px 30px 30px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
        >
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              padding: '12px 24px', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: '500', cursor: 'pointer',
              backgroundColor: '#f3f4f6', color: '#374151', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#e5e7eb'}
            onMouseOut={e => e.target.style.backgroundColor = '#f3f4f6'}
          >
            Avbryt
          </button>
          <button
            className={`btn ${confirmButtonClass}`}
            onClick={onConfirm}
            style={{
              padding: '12px 24px', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: '500', cursor: 'pointer',
              backgroundColor: '#dc2626', color: 'white', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#b91c1c'}
            onMouseOut={e => e.target.style.backgroundColor = '#dc2626'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
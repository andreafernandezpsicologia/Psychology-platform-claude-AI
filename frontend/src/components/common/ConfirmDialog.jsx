import { useEffect, useRef } from 'react';
import Button from './Button';

export default function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, danger = true }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" style={{ border: '1px solid var(--border)' }}>
        <h3 className="font-bold text-base mb-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
          {title}
        </h3>
        {description && (
          <p className="text-sm mb-5" style={{ color: 'var(--text)' }}>{description}</p>
        )}
        <div className="flex gap-3 justify-end mt-5">
          <Button ref={cancelRef} variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <button
            onClick={onConfirm}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-90"
            style={danger ? { backgroundColor: '#fce4ec', color: '#c62828' } : { backgroundColor: 'var(--navy)', color: 'white' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

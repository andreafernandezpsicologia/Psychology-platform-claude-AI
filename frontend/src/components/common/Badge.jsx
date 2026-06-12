const styles = {
  activo:               { bg: '#e8f5e9', color: '#2e7d32' },
  pendiente:            { bg: '#fff8e1', color: '#f57f17' },
  inactivo:             { bg: '#f5f5f5', color: '#9e9e9e' },
  archivado:            { bg: '#f5f5f5', color: '#757575' },
  programada:           { bg: '#e3f2fd', color: '#1565c0' },
  completada:           { bg: '#e8f5e9', color: '#2e7d32' },
  cancelada:            { bg: '#fce4ec', color: '#c62828' },
  cancelada_con_cargo:  { bg: '#fce4ec', color: '#c62828' },
  solicitada:           { bg: '#ede7f6', color: '#5e35b1' },
  ocupado:              { bg: '#eceff1', color: '#546e7a' },
};

const defaultStyle = { bg: '#f5f5f5', color: '#757575' };

export default function Badge({ estado, label }) {
  const s = styles[estado] || defaultStyle;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {label ?? estado}
    </span>
  );
}

export function badgeStyle(estado) {
  return styles[estado] || defaultStyle;
}

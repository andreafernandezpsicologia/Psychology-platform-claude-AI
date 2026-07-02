const styles = {
  activo:               { bg: '#E9F0E1', color: '#3B6D2A' },
  pendiente:            { bg: '#F8EFD2', color: '#B07A2B' },
  inactivo:             { bg: '#F1EBDE', color: '#8A7C64' },
  archivado:            { bg: '#F1EBDE', color: '#7A6A53' },
  programada:           { bg: '#E3EAF2', color: '#2C3E54' },
  completada:           { bg: '#E9F0E1', color: '#3B6D2A' },
  cancelada:            { bg: '#F6E3DD', color: '#A33B2D' },
  cancelada_con_cargo:  { bg: '#F6E3DD', color: '#A33B2D' },
  solicitada:           { bg: '#ECE6F0', color: '#6A4E8F' },
  ocupado:              { bg: '#EFEAE0', color: '#7A6A53' },
};

const defaultStyle = { bg: '#F1EBDE', color: '#7A6A53' };

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

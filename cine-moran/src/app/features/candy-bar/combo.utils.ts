import { Combo } from './producto.model';

// Texto de lo que trae un combo, ej: "2 entradas + 2x Pochoclos grandes + 2x Gaseosa"
export function detalleCombo(combo: Combo): string {
  const partes: string[] = [];
  if (combo.entradasIncluidas > 0) {
    partes.push(`${combo.entradasIncluidas} entrada${combo.entradasIncluidas > 1 ? 's' : ''}`);
  }
  for (const p of combo.productos) partes.push(`${p.cantidad}x ${p.nombre}`);
  return partes.join(' + ');
}

import { Butaca } from './sala.model';

export interface FilaAgrupada {
  fila: string;
  bloques: Butaca[][];
  accesible: boolean;
  vacia?: boolean;
}

// Ancho de una butaca y el espacio entre butacas, en rem. Tienen que coincidir
// con .butaca y .bloque-butacas en styles.css: se usan para calcular cuánto
// tiene que medir un bloque con menos butacas para que ocupe el mismo ancho
// que el bloque equivalente de una fila normal (ver calcularAnchosBloque).
export const ANCHO_BUTACA_REM = 1.6;
export const GAP_BUTACA_REM = 0.3;

// Agrupa las butacas por fila y, dentro de cada fila, por bloque (columna 1,
// 2 o 3: los mismos bloques de 4/20/4 -o 2/10/2 en la fila accesible- que
// pidió el cliente). Sirve para dibujar el pasillo entre bloques, como en
// una sala real, en vez de una tira continua de butacas.
export function agruparPorFilaYBloque(butacas: Butaca[]): FilaAgrupada[] {
  const porFila = new Map<string, Butaca[]>();
  for (const b of butacas) {
    if (!porFila.has(b.fila)) porFila.set(b.fila, []);
    porFila.get(b.fila)!.push(b);
  }

  const filas: FilaAgrupada[] = Array.from(porFila.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fila, butacasDeFila]) => {
      const porColumna = new Map<number, Butaca[]>();
      for (const b of butacasDeFila) {
        if (!porColumna.has(b.columna)) porColumna.set(b.columna, []);
        porColumna.get(b.columna)!.push(b);
      }
      const bloques = Array.from(porColumna.entries())
        .sort(([a], [b]) => a - b)
        .map(([, arr]) => arr);
      return { fila, bloques, accesible: butacasDeFila[0]?.tipo === 'accesible' };
    });

  // El cliente sacó DOS filas (J y K) y puso UNA sola fila accesible en su
  // lugar (esa fila quedó guardada como "J" en la base). Mostrar ese espacio
  // vacío como una fila más -en vez de un simple margen- deja claro que ahí
  // falta una fila entera. Va ANTES de la fila accesible (entre I y J): es
  // el pasillo por donde entra la gente para llegar a esas butacas, no un
  // sobrante detrás. No lleva letra (I, "K", J, L quedaría con las letras
  // desordenadas, ya que la butaca real sigue guardada como "J").
  const indiceAccesible = filas.findIndex((f) => f.accesible);
  if (indiceAccesible !== -1) {
    filas.splice(indiceAccesible, 0, { fila: '', bloques: [], accesible: false, vacia: true });
  }

  return filas;
}

// Para cada posición de bloque (1, 2 o 3) calcula cuántas butacas tiene la
// fila MÁS ANCHA en esa posición (4, 20 y 4 en esta sala). Sirve para que la
// fila accesible (2, 10 y 2) ocupe el mismo ancho físico que las demás filas
// en cada bloque, con sus butacas más separadas entre sí, en vez de verse
// como un grupo más chico y suelto en el medio de la sala.
export function calcularAnchosBloque(butacas: Butaca[]): number[] {
  const cantidadPorFilaYColumna = new Map<string, number>();
  for (const b of butacas) {
    const clave = `${b.fila}-${b.columna}`;
    cantidadPorFilaYColumna.set(clave, (cantidadPorFilaYColumna.get(clave) ?? 0) + 1);
  }

  const maximoPorColumna = new Map<number, number>();
  for (const b of butacas) {
    const clave = `${b.fila}-${b.columna}`;
    const cantidad = cantidadPorFilaYColumna.get(clave)!;
    maximoPorColumna.set(b.columna, Math.max(maximoPorColumna.get(b.columna) ?? 0, cantidad));
  }

  return Array.from(maximoPorColumna.entries())
    .sort(([a], [b]) => a - b)
    .map(([, cantidad]) => cantidad);
}

// Ancho (en rem) que tiene que ocupar un bloque para caber "cantidadButacas"
// butacas del tamaño estándar, separadas por el gap estándar.
export function anchoBloqueRem(cantidadButacas: number): number {
  return cantidadButacas * ANCHO_BUTACA_REM + (cantidadButacas - 1) * GAP_BUTACA_REM;
}

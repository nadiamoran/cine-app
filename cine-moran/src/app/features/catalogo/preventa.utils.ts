import { Pelicula } from './pelicula.model';

// RF-29: misma regla que crear_orden (migración 023). Acá solo sirve para
// mostrar; el precio que se cobra lo calcula la base.
//   - sin_preventa: la película no tiene preventa (o no tiene estreno)
//   - por_abrir:    falta más de 7 días para el estreno, todavía no se vende
//   - abierta:      se vende con el descuento hasta el día anterior al estreno
//   - terminada:    ya se estrenó, precio normal
export type EstadoPreventa = 'sin_preventa' | 'por_abrir' | 'abierta' | 'terminada';

export interface InfoPreventa {
  estado: EstadoPreventa;
  descuento: number;
  apertura: Date | null; // 7 días antes del estreno
  ultimoDia: Date | null; // día anterior al estreno
}

// fecha_estreno es "yyyy-mm-dd"; el estreno empieza a las 00:00 de Argentina
// (UTC-3, sin horario de verano)
function inicioEstreno(fechaEstreno: string): Date {
  return new Date(`${fechaEstreno}T00:00:00-03:00`);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
}

export function infoPreventa(
  pelicula: Pick<Pelicula, 'fechaEstreno' | 'preventaDescuento'>,
  ahora = new Date(),
): InfoPreventa {
  if (!pelicula.preventaDescuento || !pelicula.fechaEstreno) {
    return { estado: 'sin_preventa', descuento: 0, apertura: null, ultimoDia: null };
  }

  const estreno = inicioEstreno(pelicula.fechaEstreno);
  const apertura = sumarDias(estreno, -7);
  const ultimoDia = sumarDias(estreno, -1);
  const estado: EstadoPreventa =
    ahora < apertura ? 'por_abrir' : ahora < estreno ? 'abierta' : 'terminada';

  return { estado, descuento: pelicula.preventaDescuento, apertura, ultimoDia };
}

// precio que se cobra hoy: con descuento solo mientras la preventa está abierta
export function precioVigente(precio: number, preventa: InfoPreventa): number {
  return preventa.estado === 'abierta' ? precio - preventa.descuento : precio;
}

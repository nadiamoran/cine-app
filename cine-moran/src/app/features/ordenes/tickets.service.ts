import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { OrdenConButacas } from './orden.model';
import { Funcion } from '../funciones/funcion.model';
import { Pelicula } from '../catalogo/pelicula.model';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  // Arma un PDF con una página por butaca comprada (cada una con su propio
  // QR: van a validarse una por una en la puerta, no todas juntas). El QR
  // codifica el id de esa butaca-en-esa-orden (orden_butacas.id): cuando
  // exista la pantalla de validación de empleados, va a buscar ese id y
  // marcarlo como usado.
  async generarPdf(datos: { resultado: OrdenConButacas; funcion: Funcion; pelicula: Pelicula }) {
    const { resultado, funcion, pelicula } = datos;
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });

    const fechaHora = new Date(funcion.inicio).toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (let i = 0; i < resultado.butacas.length; i++) {
      const butaca = resultado.butacas[i];
      if (i > 0) doc.addPage();

      const qrDataUrl = await QRCode.toDataURL(butaca.ordenButacaId, { margin: 1, width: 300 });

      let y = 15;
      const linea = (texto: string, salto = 6) => {
        doc.text(texto, 12, y);
        y += salto;
      };

      doc.setFontSize(20);
      linea('CineMoran', 10);

      doc.setFontSize(14);
      linea(pelicula.nombre, 9);

      doc.setFontSize(10);
      linea(`Función: ${fechaHora}`);
      linea(
        `Sala: ${funcion.nombreSala} · ${funcion.formato.toUpperCase()} · ${
          funcion.idioma === 'castellano' ? 'Castellano' : 'Subtitulada'
        }`,
      );
      linea(`Butaca: ${butaca.fila}${butaca.numero} (${butaca.tipo})`);
      linea(`Precio: $${funcion.precio}`);

      if (resultado.productos.length > 0) {
        const detalleCandy = resultado.productos.map((p) => `${p.cantidad}x ${p.nombre}`).join(', ');
        linea(`Candy bar: ${detalleCandy}`, 9);
      }

      linea(`Orden: ${resultado.orden.id.slice(0, 8)}`, 9);

      if (pelicula.restriccionEdad !== 'sin_restriccion') {
        doc.setTextColor(180, 40, 40);
        linea(`Apta ${pelicula.restriccionEdad} — debe ir acompañado de un adulto`, 9);
        doc.setTextColor(0, 0, 0);
      }

      doc.addImage(qrDataUrl, 'PNG', 12, y, 45, 45);
      doc.setFontSize(8);
      doc.text('Presentá este código en la entrada del cine y del candy bar.', 12, y + 50);
      doc.text(`Código (si el lector no funciona): ${butaca.ordenButacaId}`, 12, y + 55);
    }

    const nombreArchivo = `entradas-${pelicula.nombre.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    doc.save(nombreArchivo);
  }
}

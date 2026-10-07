import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { FilaFacturacion, ItemRanking, ReportesService } from './reportes.service';

type PeriodoFacturacion = '7' | '30' | 'mes';
type PeriodoRanking = 'semana' | 'mes';

// "yyyy-mm-dd" en hora local (lo que esperan las funciones de reporte)
function fechaTexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

// RF-52: facturación por día y entradas vendidas
// RF-53: exportar ese reporte a PDF y a Excel
// RF-54: películas más vistas (semana / mes) y productos más vendidos
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './reportes.component.html',
})
export class ReportesComponent implements OnInit {
  readonly periodosFacturacion: { valor: PeriodoFacturacion; etiqueta: string }[] = [
    { valor: '7', etiqueta: 'Últimos 7 días' },
    { valor: '30', etiqueta: 'Últimos 30 días' },
    { valor: 'mes', etiqueta: 'Este mes' },
  ];
  readonly periodosRanking: { valor: PeriodoRanking; etiqueta: string }[] = [
    { valor: 'semana', etiqueta: 'Esta semana' },
    { valor: 'mes', etiqueta: 'Este mes' },
  ];

  // ---- facturación ----
  periodoFacturacion = signal<PeriodoFacturacion>('7');
  cargandoFacturacion = signal(true);
  filas = signal<FilaFacturacion[]>([]);

  totalEntradas = computed(() => this.filas().reduce((suma, f) => suma + f.entradas, 0));
  totalFacturado = computed(() => this.filas().reduce((suma, f) => suma + f.facturado, 0));

  // ---- gráficos ----
  periodoRanking = signal<PeriodoRanking>('semana');
  cargandoRanking = signal(true);
  peliculas = signal<ItemRanking[]>([]);
  productos = signal<ItemRanking[]>([]);

  constructor(private reportesService: ReportesService) {}

  async ngOnInit() {
    await Promise.all([this.cargarFacturacion(), this.cargarRanking()]);
  }

  // ---------- facturación ----------

  private rangoFacturacion(): { desde: string; hasta: string } {
    const hoy = new Date();
    const desde = new Date(hoy);
    const periodo = this.periodoFacturacion();
    if (periodo === 'mes') desde.setDate(1);
    else desde.setDate(hoy.getDate() - (Number(periodo) - 1));
    return { desde: fechaTexto(desde), hasta: fechaTexto(hoy) };
  }

  async onCambiarPeriodoFacturacion(periodo: PeriodoFacturacion) {
    this.periodoFacturacion.set(periodo);
    await this.cargarFacturacion();
  }

  private async cargarFacturacion() {
    this.cargandoFacturacion.set(true);
    const { desde, hasta } = this.rangoFacturacion();
    this.filas.set(await this.reportesService.facturacion(desde, hasta));
    this.cargandoFacturacion.set(false);
  }

  // ---------- gráficos ----------

  private rangoRanking(): { desde: string; hasta: string } {
    const hoy = new Date();
    const desde = new Date(hoy);
    const hasta = new Date(hoy);
    if (this.periodoRanking() === 'mes') {
      desde.setDate(1);
      hasta.setMonth(hoy.getMonth() + 1, 0); // último día del mes
    } else {
      // semana de lunes a domingo
      const diaSemana = (hoy.getDay() + 6) % 7; // 0 = lunes
      desde.setDate(hoy.getDate() - diaSemana);
      hasta.setDate(desde.getDate() + 6);
    }
    return { desde: fechaTexto(desde), hasta: fechaTexto(hasta) };
  }

  async onCambiarPeriodoRanking(periodo: PeriodoRanking) {
    this.periodoRanking.set(periodo);
    await this.cargarRanking();
  }

  private async cargarRanking() {
    this.cargandoRanking.set(true);
    const { desde, hasta } = this.rangoRanking();
    const [peliculas, productos] = await Promise.all([
      this.reportesService.peliculasMasVistas(desde, hasta),
      this.reportesService.productosMasVendidos(desde, hasta),
    ]);
    this.peliculas.set(peliculas);
    this.productos.set(productos);
    this.cargandoRanking.set(false);
  }

  // ancho de cada barra: el primero del ranking ocupa el 100%
  anchoBarra(item: ItemRanking, lista: ItemRanking[]): number {
    const maximo = lista[0]?.cantidad ?? 0;
    return maximo ? Math.max((item.cantidad / maximo) * 100, 2) : 0;
  }

  // ---------- exportación (RF-53) ----------

  private etiquetaPeriodo(): string {
    const { desde, hasta } = this.rangoFacturacion();
    const formato = (texto: string) => texto.split('-').reverse().join('/');
    return `${formato(desde)} al ${formato(hasta)}`;
  }

  private fechaCorta(fecha: string): string {
    return fecha.split('-').reverse().join('/');
  }

  private pesos(valor: number): string {
    return '$' + valor.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  }

  // PDF con jsPDF (la misma librería de las entradas)
  onExportarPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;

    doc.setFontSize(18);
    doc.text('CineMoran - Reporte de facturación', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Período: ${this.etiquetaPeriodo()}`, 15, y);
    y += 12;

    const columnas = [15, 90, 150];
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', columnas[0], y);
    doc.text('Entradas vendidas', columnas[1], y);
    doc.text('Facturado', columnas[2], y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;
    doc.setFont('helvetica', 'normal');

    for (const fila of this.filas()) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(this.fechaCorta(fila.fecha), columnas[0], y);
      doc.text(String(fila.entradas), columnas[1], y);
      doc.text(this.pesos(fila.facturado), columnas[2], y);
      y += 7;
    }

    doc.line(15, y - 3, 195, y - 3);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', columnas[0], y);
    doc.text(String(this.totalEntradas()), columnas[1], y);
    doc.text(this.pesos(this.totalFacturado()), columnas[2], y);

    const { desde, hasta } = this.rangoFacturacion();
    doc.save(`facturacion-${desde}-al-${hasta}.pdf`);
  }

  // Excel (.xlsx) con SheetJS: una hoja con la misma tabla
  onExportarExcel() {
    const filas = this.filas().map((fila) => ({
      Fecha: this.fechaCorta(fila.fecha),
      'Entradas vendidas': fila.entradas,
      Facturado: fila.facturado,
    }));
    filas.push({ Fecha: 'TOTAL', 'Entradas vendidas': this.totalEntradas(), Facturado: this.totalFacturado() });

    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Facturación');

    const { desde, hasta } = this.rangoFacturacion();
    XLSX.writeFile(libro, `facturacion-${desde}-al-${hasta}.xlsx`);
  }
}

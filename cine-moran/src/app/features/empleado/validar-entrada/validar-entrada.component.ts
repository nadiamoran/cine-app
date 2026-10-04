import { Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ValidacionService } from '../validacion.service';
import { EntradaValidada } from '../validacion.model';

@Component({
  selector: 'app-validar-entrada',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './validar-entrada.component.html',
})
export class ValidarEntradaComponent implements OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  validando = signal(false);
  resultado = signal<EntradaValidada | null>(null);
  resultadoCandy = signal<{ nombre: string; cantidad: number }[] | null>(null);
  errorMsg = signal<string | null>(null);

  // el escaneo por cámara es una mejora: si el navegador no lo soporta, o el
  // usuario no da permiso, el código a mano (RF-49) sigue funcionando igual
  camaraDisponible = signal('BarcodeDetector' in window);
  escaneando = signal(false);

  codigoForm = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private stream: MediaStream | null = null;
  private detenerLoop = false;

  constructor(private validacionService: ValidacionService) {}

  ngOnDestroy() {
    this.detenerCamara();
  }

  async onValidarCodigo() {
    if (this.codigoForm.invalid) {
      this.codigoForm.markAllAsTouched();
      return;
    }
    await this.validarCodigo(this.codigoForm.getRawValue().codigo.trim());
  }

  private async validarCodigo(codigo: string) {
    this.errorMsg.set(null);
    this.resultado.set(null);
    this.resultadoCandy.set(null);
    this.validando.set(true);

    const { entrada, error } = await this.validacionService.validar(codigo);
    this.validando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.resultado.set(entrada);
    this.codigoForm.reset();
  }

  // Retira los productos de candy bar de la orden (con el mismo código de
  // cualquiera de sus entradas). Independiente de "Validar": no hace falta
  // haber validado la entrada para retirar el candy, ni al revés.
  async onRetirarCandy() {
    if (this.codigoForm.invalid) {
      this.codigoForm.markAllAsTouched();
      return;
    }

    this.errorMsg.set(null);
    this.resultado.set(null);
    this.resultadoCandy.set(null);
    this.validando.set(true);

    const codigo = this.codigoForm.getRawValue().codigo.trim();
    const { items, error } = await this.validacionService.retirarCandy(codigo);
    this.validando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.resultadoCandy.set(items);
    this.codigoForm.reset();
  }

  async onIniciarCamara() {
    this.errorMsg.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.errorMsg.set('No se pudo acceder a la cámara. Usá el código a mano.');
      return;
    }

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    video.srcObject = this.stream;
    await video.play();

    this.escaneando.set(true);
    this.detenerLoop = false;
    this.loopDeteccion(video);
  }

  onDetenerCamara() {
    this.detenerCamara();
  }

  private detenerCamara() {
    this.detenerLoop = true;
    this.escaneando.set(false);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  // Lee frames de la cámara buscando un QR. Apenas encuentra uno, corta el
  // loop, apaga la cámara y valida ese código (misma función que el manual).
  private async loopDeteccion(video: HTMLVideoElement) {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

    while (!this.detenerLoop) {
      try {
        const codigos = await detector.detect(video);
        if (codigos.length > 0) {
          const valor = codigos[0].rawValue;
          this.detenerCamara();
          await this.validarCodigo(valor);
          return;
        }
      } catch {
        // sigue intentando en el próximo frame
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

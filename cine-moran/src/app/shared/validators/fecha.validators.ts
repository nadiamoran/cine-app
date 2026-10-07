import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validador sincrónico propio (mismo formato que los vistos en clase):
// una fecha de nacimiento no puede ser posterior a hoy.
// Devuelve null si es válida, o un objeto con la clave del error si no lo es.
export function fechaNoFuturaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // si está vacío lo maneja Validators.required

    // el input type="date" entrega "yyyy-mm-dd"; lo comparo como texto contra hoy
    // para evitar problemas de zona horaria al convertir a Date
    const hoy = new Date().toISOString().slice(0, 10);
    return control.value > hoy ? { fechaFutura: true } : null;
  };
}

// La fecha tiene que tener un año de 4 cifras dentro de un rango razonable.
// Sin esto, el input type="date" deja escribir años como 20056 (o 0999) y la
// fecha se guarda igual.
export function fechaEnRangoValidator(anioMinimo: number, anioMaximo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // si está vacío lo maneja Validators.required

    const partes = /^(\d{4})-\d{2}-\d{2}$/.exec(control.value);
    if (!partes) return { fechaInvalida: true };

    const anio = Number(partes[1]);
    return anio < anioMinimo || anio > anioMaximo
      ? { fechaFueraDeRango: { anioMinimo, anioMaximo } }
      : null;
  };
}

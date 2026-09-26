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

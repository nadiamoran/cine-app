import { CanDeactivateFn } from '@angular/router';

// Mismo patron que formGuard de la clase (canDeactivate): el componente
// decide si es seguro salir, el guard solo pregunta si no lo es.
export interface ComponentePuedeSalir {
  puedeSalir(): boolean;
}

export const confirmarSalidaGuard: CanDeactivateFn<ComponentePuedeSalir> = (component) => {
  if (component.puedeSalir()) return true;
  return confirm('Tenés butacas seleccionadas sin confirmar. ¿Seguro que querés salir?');
};

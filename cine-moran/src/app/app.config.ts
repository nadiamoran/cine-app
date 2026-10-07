import { ApplicationConfig, LOCALE_ID, isDevMode, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

// fechas en castellano en toda la app: el DatePipe usa este idioma
// ("jueves 09/10" en vez de "Thursday 09/10")
registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideRouter(routes),
    // el service worker solo se registra en produccion (isDevMode() = false):
    // en desarrollo molestaria cacheando versiones viejas mientras se edita
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

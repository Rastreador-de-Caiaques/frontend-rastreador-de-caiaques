import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

bootstrapApplication(AppComponent, {
  providers: [provideServiceWorker('ngsw-worker.js', {
              enabled: !isDevMode(),
              registrationStrategy: 'registerWhenStable:30000'
            })]
}).catch(err => console.error(err));
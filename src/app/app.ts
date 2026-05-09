import { Component } from '@angular/core';
import { MapaComponent } from './mapa/mapa';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapaComponent],
  template: '<app-mapa></app-mapa>'
})
export class AppComponent {}
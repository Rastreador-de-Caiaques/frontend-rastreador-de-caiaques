import {
  Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { CaiaqueService, Caiaque } from '../services/caiaques.service';
import { PainelCaiaque } from '../painel-caiaque/painel-caiaque';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, PainelCaiaque],
  templateUrl: './mapa.html',
  styleUrls: ['./mapa.scss']
})
export class MapaComponent implements OnInit, AfterViewInit, OnDestroy {

  private map!: L.Map;
  private marcadores: Map<number, L.Marker> = new Map();
  private rotaLayer: L.Polyline | null = null;
  private sub!: Subscription;

  caiaques: Caiaque[] = [];
  caiaaqueSelecionado: Caiaque | null = null;
  ultimaSync: Date = new Date();

  constructor(
    private caiaqueService: CaiaqueService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.iniciarMapa();
    this.iniciarPolling();
  }

  private iniciarMapa(): void {
    this.map = L.map('mapa', {
      center: [-23.965, -46.335],
      zoom: 14,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  private criarIconeCaiaque(id: number): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `
        <div class="icone-caiaque">
          <div class="icone-pulso"></div>
          <div class="icone-corpo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M3 13.5C3 13.5 5 10 12 10s9 3.5 9 3.5v1s-2 1.5-9 1.5-9-1.5-9-1.5v-1z"/>
              <path d="M7 10.5L9 7h6l2 3.5"/>
              <circle cx="12" cy="5.5" r="1.5"/>
            </svg>
            <span class="icone-num">${id}</span>
          </div>
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 52],
      popupAnchor: [0, -52]
    });
  }

  private iniciarPolling(): void {
    this.sub = this.caiaqueService.caiaques$.subscribe(data => {
      this.caiaques = data.caiaques;
      this.ultimaSync = new Date();
      this.atualizarMarcadores();
      this.cdr.detectChanges();
    });
  }

  private atualizarMarcadores(): void {
    this.caiaques.forEach(caiaque => {
      const pos: L.LatLngExpression = [caiaque.lat, caiaque.lng];

      if (this.marcadores.has(caiaque.id)) {
        this.marcadores.get(caiaque.id)!.setLatLng(pos);
      } else {
        const marker = L.marker(pos, {
          icon: this.criarIconeCaiaque(caiaque.id)
        })
          .addTo(this.map)
          .on('click', () => this.selecionarCaiaque(caiaque));

        this.marcadores.set(caiaque.id, marker);
      }
    });
  }

selecionarCaiaque(caiaque: Caiaque): void {
  this.caiaaqueSelecionado = caiaque;

  // Offset para centralizar o caiaque na metade superior da tela
  const ponto = this.map.project([caiaque.lat, caiaque.lng], 15);
  ponto.y += window.innerHeight * 0.18; // empurra para cima visualmente
  const coordAjustada = this.map.unproject(ponto, 15);

  this.map.flyTo(coordAjustada, 15, { duration: 0.8 });
}

  mostrarRota(caiaque: Caiaque): void {
    if (this.rotaLayer) {
      this.map.removeLayer(this.rotaLayer);
    }

    const pontos: L.LatLngExpression[] = caiaque.rota.map(p => [p.lat, p.lng]);

    this.rotaLayer = L.polyline(pontos, {
      color: '#00e5ff',
      weight: 3,
      opacity: 0.8,
      dashArray: '8, 6'
    }).addTo(this.map);
  }

  fecharPainel(): void {
    this.caiaaqueSelecionado = null;

    if (this.rotaLayer) {
      this.map.removeLayer(this.rotaLayer);
      this.rotaLayer = null;
    }
  }

  centralizarMapa(): void {
    if (this.caiaques.length === 0) return;

    const bounds = L.latLngBounds(
      this.caiaques.map(c => [c.lat, c.lng] as L.LatLngExpression)
    );
    this.map.fitBounds(bounds, { padding: [60, 60] });
  }

  formatarHora(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.map?.remove();
  }
}
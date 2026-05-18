import {
  Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { CaiaqueService, Caiaque, Notificacao } from '../services/caiaques.service';
import { PainelCaiaque } from '../painel-caiaque/painel-caiaque';
import { PainelStatus } from '../painel-status/painel-status';

interface NotificacaoAtiva extends Notificacao {
  saindo: boolean;
}

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, PainelCaiaque, PainelStatus],
  templateUrl: './mapa.html',
  styleUrls: ['./mapa.scss']
})
export class MapaComponent implements OnInit, AfterViewInit, OnDestroy {

  private map!: L.Map;
  private marcadores: Map<number, L.Marker> = new Map();
  private rotaLayer: L.Polyline | null = null;
  private sub!: Subscription;
  private subConexao!: Subscription;
  private subNotif!: Subscription;

  caiaques: Caiaque[] = [];
  caiaaqueSelecionado: Caiaque | null = null;
  ultimaSync: Date = new Date();
  servidorConectado = false;
  notificacoes: NotificacaoAtiva[] = [];
  painelStatusAberto = false;

  constructor(
    private caiaqueService: CaiaqueService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.iniciarMapa();
    this.iniciarPolling();
    this.iniciarNotificacoes();
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
        <div style="position:relative;width:52px;height:52px;display:flex;align-items:flex-end;justify-content:center;">
          <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:44px;height:44px;border-radius:50%;background:rgba(0,119,182,0.2);animation:pulso 2.5s ease-out infinite;"></div>
          <div style="position:relative;width:40px;height:40px;background:#0077b6;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,119,182,0.5);color:#fff;gap:1px;">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M3 13.5C3 13.5 5 10 12 10s9 3.5 9 3.5v1s-2 1.5-9 1.5-9-1.5-9-1.5v-1z"/>
              <path d="M7 10.5L9 7h6l2 3.5"/>
              <circle cx="12" cy="5.5" r="1.5"/>
            </svg>
            <span style="font-family:monospace;font-size:0.65rem;font-weight:700;line-height:1;color:#fff;">${id}</span>
          </div>
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -30]
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

  private iniciarNotificacoes(): void {
    this.subConexao = this.caiaqueService.connected$.subscribe(conectado => {
      this.servidorConectado = conectado;
      this.cdr.detectChanges();
    });

    this.subNotif = this.caiaqueService.notificacoes$.subscribe(n => {
      const item: NotificacaoAtiva = { ...n, saindo: false };
      this.notificacoes.push(item);
      this.cdr.detectChanges();

      // Inicia saída após 3.6s e remove após a animação (400ms)
      setTimeout(() => {
        item.saindo = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.notificacoes = this.notificacoes.filter(x => x.id !== n.id);
          this.cdr.detectChanges();
        }, 400);
      }, 3600);
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

    const ponto = this.map.project([caiaque.lat, caiaque.lng], 15);
    ponto.y += window.innerHeight * 0.18;
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

  abrirPainelStatus(): void {
    this.painelStatusAberto = true;
  }

  formatarHora(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subConexao?.unsubscribe();
    this.subNotif?.unsubscribe();
    this.map?.remove();
  }
}

import {
  Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { CaiaqueService, Caiaque, SessaoCaiaque, Notificacao } from '../services/caiaques.service';
import { PainelCaiaque } from '../painel-caiaque/painel-caiaque';
import { PainelStatus } from '../painel-status/painel-status';
import { EstadoSinal } from '../services/estado-sinal';

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
  private rastros:    Map<number, L.Polyline> = new Map();
  private estadosMarcador: Map<number, EstadoSinal> = new Map();
  private sub!: Subscription;

  private readonly CORES_RASTRO = [
    '#00e5ff', '#ff6b6b', '#a8ff78', '#ffbe0b',
    '#fb5607', '#8338ec', '#ff006e', '#3a86ff'
  ];
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

  private criarIconeCaiaque(id: number, estado: EstadoSinal = 'ao-vivo'): L.DivIcon {
    const cores = [
      { casco: '#2d9e4f', borda: '#4fc970', escuro: '#1a5c32', highlight: '#6ade8a' },
      { casco: '#0077b6', borda: '#48cae4', escuro: '#023e8a', highlight: '#90e0ef' },
      { casco: '#e63946', borda: '#ff6b6b', escuro: '#9d0208', highlight: '#ffb3b3' },
      { casco: '#e76f51', borda: '#f4a261', escuro: '#9c4221', highlight: '#fcd5b5' },
    ];

    const c = cores[(id - 1) % cores.length];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="64" height="64">
        <ellipse cx="50" cy="54" rx="38" ry="9" fill="${c.escuro}" opacity="0.20"/>
        <ellipse cx="50" cy="50" rx="42" ry="13" fill="${c.casco}" transform="rotate(-35, 50, 50)"/>
        <ellipse cx="50" cy="50" rx="42" ry="13" fill="none" stroke="${c.borda}" stroke-width="1.5" transform="rotate(-35, 50, 50)"/>
        <ellipse cx="50" cy="50" rx="10" ry="6" fill="${c.escuro}" transform="rotate(-35, 50, 50)"/>
        <ellipse cx="50" cy="50" rx="10" ry="6" fill="none" stroke="${c.borda}" stroke-width="1" transform="rotate(-35, 50, 50)"/>
        <ellipse cx="43" cy="44" rx="14" ry="3.5" fill="${c.highlight}" opacity="0.35" transform="rotate(-35, 43, 44)"/>
        <line x1="14" y1="78" x2="86" y2="22" stroke="${c.escuro}" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="18" cy="74" rx="9" ry="5" fill="${c.escuro}" stroke="${c.borda}" stroke-width="1" transform="rotate(-35, 18, 74)"/>
        <ellipse cx="18" cy="74" rx="9" ry="5" fill="${c.borda}" opacity="0.3" transform="rotate(-35, 18, 74)"/>
        <ellipse cx="82" cy="26" rx="9" ry="5" fill="${c.escuro}" stroke="${c.borda}" stroke-width="1" transform="rotate(-35, 82, 26)"/>
        <ellipse cx="82" cy="26" rx="9" ry="5" fill="${c.borda}" opacity="0.3" transform="rotate(-35, 82, 26)"/>
        <line x1="11" y1="53" x2="89" y2="47" stroke="${c.escuro}" stroke-width="1" opacity="0.5" transform="rotate(-35, 50, 50)"/>
        <circle cx="72" cy="28" r="10" fill="white" opacity="0.92"/>
        <text x="72" y="32" font-family="monospace" font-size="11" font-weight="700" text-anchor="middle" fill="${c.escuro}">${id}</text>
      </svg>
    `;

    return L.divIcon({
      className: '',
      html: `
        <div style="
          position: relative;
          width: 64px;
          height: 64px;
          opacity: ${estado === 'ao-vivo' ? 1 : estado === 'fraco' ? 0.65 : 0.85};
          filter: ${estado === 'sem-sinal' ? 'grayscale(1) ' : ''}drop-shadow(0 3px 6px rgba(0,0,0,0.28));
        ">${svg}${estado === 'sem-sinal' ? this.selo('!', '#b3261e') : ''}</div>
      `,
      iconSize:    [64, 64],
      iconAnchor:  [32, 32],
      popupAnchor: [0, -36]
    });
  }

  /** Selo redondo no canto do marcador (usado para "sem sinal"). */
  private selo(texto: string, cor: string): string {
    return `<span style="position:absolute;right:4px;top:2px;width:20px;height:20px;border-radius:50%;
      background:${cor};border:2px solid #fff;color:#fff;font:700 13px/16px sans-serif;text-align:center">${texto}</span>`;
  }

  private iniciarPolling(): void {
    this.sub = this.caiaqueService.caiaques$.subscribe(data => {
      this.caiaques = data.caiaques;
      this.ultimaSync = new Date();
      if (this.caiaaqueSelecionado) {
        // O painel acompanha a versão mais recente (ou fecha se o passeio foi encerrado).
        this.caiaaqueSelecionado = data.caiaques.find(c => c.id === this.caiaaqueSelecionado!.id) ?? null;
      }
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
    // Tira do mapa quem não está mais na lista (passeio encerrado).
    const ativos = new Set(this.caiaques.map(c => c.id));
    [...this.marcadores.keys()].filter(id => !ativos.has(id)).forEach(id => {
      this.marcadores.get(id)?.remove();
      this.marcadores.delete(id);
      this.rastros.get(id)?.remove();
      this.rastros.delete(id);
      this.estadosMarcador.delete(id);
    });

    this.caiaques.forEach(caiaque => {
      const pos: L.LatLngExpression = [caiaque.lat, caiaque.lng];
      const estado: EstadoSinal = caiaque.estado ?? 'ao-vivo';

      if (this.marcadores.has(caiaque.id)) {
        const marker = this.marcadores.get(caiaque.id)!;
        marker.setLatLng(pos);
        if (this.estadosMarcador.get(caiaque.id) !== estado) {
          marker.setIcon(this.criarIconeCaiaque(caiaque.id, estado));
        }
      } else {
        const marker = L.marker(pos, {
          icon: this.criarIconeCaiaque(caiaque.id, estado)
        })
          .addTo(this.map)
          .on('click', () => {
            const atual = this.caiaques.find(c => c.id === caiaque.id);
            if (atual) this.selecionarCaiaque(atual);
          });

        this.marcadores.set(caiaque.id, marker);
      }
      this.estadosMarcador.set(caiaque.id, estado);
      this.rastros.get(caiaque.id)?.setStyle({ opacity: estado === 'sem-sinal' ? 0.3 : 0.75 });

      this.atualizarRastro(caiaque);
    });
  }

  private corParaCaiaque(id: number): string {
    return this.CORES_RASTRO[(id - 1) % this.CORES_RASTRO.length];
  }

  private atualizarRastro(caiaque: SessaoCaiaque): void {
    if (!caiaque.historico || caiaque.historico.length < 2) return;

    const pontos: L.LatLngExpression[] = caiaque.historico.map(p => [p.lat, p.lng]);
    const cor = this.corParaCaiaque(caiaque.id);

    if (this.rastros.has(caiaque.id)) {
      this.rastros.get(caiaque.id)!.setLatLngs(pontos);
    } else {
      const polyline = L.polyline(pontos, {
        color: cor,
        weight: 3,
        opacity: 0.75,
        dashArray: '8, 6'
      }).addTo(this.map);
      this.rastros.set(caiaque.id, polyline);
    }
  }

  selecionarCaiaque(caiaque: Caiaque): void {
    this.caiaaqueSelecionado = caiaque;

    const ponto = this.map.project([caiaque.lat, caiaque.lng], 15);
    ponto.y += window.innerHeight * 0.18;
    const coordAjustada = this.map.unproject(ponto, 15);

    this.map.flyTo(coordAjustada, 15, { duration: 0.8 });
  }

  fecharPainel(): void {
    this.caiaaqueSelecionado = null;
  }

  encerrarPasseio(caiaque: Caiaque): void {
    this.caiaqueService.encerrarPasseio(caiaque.id);
    this.caiaaqueSelecionado = null;
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
    this.rastros.forEach(r => r.remove());
    this.map?.remove();
  }
}

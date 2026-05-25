import { Injectable, OnDestroy } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PontoRota {
  lat: number;
  lng: number;
  hora: string;
}

export interface PontoHistorico {
  lat: number;
  lng: number;
  timestamp: number; // Date.now()
}

export interface SessaoCaiaque {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  ultimaAtualizacao: string;
  rota: PontoRota[];           // mantida para compatibilidade com painel-caiaque
  historico: PontoHistorico[]; // array acumulado para rastro e tempo no mar
  primeiroSinal: number;       // timestamp do primeiro ponto recebido
  ultimoSinal: number;         // timestamp do último ponto recebido
}

export type Caiaque = SessaoCaiaque;

export interface CaiaqueResponse {
  caiaques: Caiaque[];
}

export interface StatusCaiaque {
  id: number;
  nome: string;
  temGPS: boolean;
  ultimaAtualizacao: Date | null;
}

export interface Notificacao {
  id: number;
  tipo: 'servidor' | 'caiaque';
  mensagem: string;
  cor: 'sucesso' | 'erro' | 'info';
}

type WsMensagem =
  | { tipo: 'base' }
  | { tipo: 'conectado' }
  | { id: number; lat: number | null; lng: number | null; bat?: number; vel?: number };

@Injectable({ providedIn: 'root' })
export class CaiaqueService implements OnDestroy {

  private readonly WS_URL = environment.backendWsUrl;
  private socket$: WebSocketSubject<WsMensagem>;

  private estado           = new Map<number, Caiaque>();
  private statusMap        = new Map<number, StatusCaiaque>();
  private kayaksConhecidos = new Set<number>();
  private notifId          = 0;
  private baseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly STORAGE_KEY        = 'rastreador_sessoes';
  private readonly DEBOUNCE_SAVE_MS   = 5000;
  private readonly DISTANCIA_MINIMA_M = 5;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private subject$$        = new BehaviorSubject<CaiaqueResponse>({ caiaques: [] });
  private connected$$      = new BehaviorSubject<boolean>(false);
  private notificacoes$$   = new Subject<Notificacao>();
  private espBase$$        = new BehaviorSubject<'online' | 'aguardando' | 'offline'>('aguardando');
  private statusCaiaques$$ = new BehaviorSubject<StatusCaiaque[]>([]);

  caiaques$:       Observable<CaiaqueResponse>                     = this.subject$$.asObservable();
  connected$:      Observable<boolean>                             = this.connected$$.asObservable();
  notificacoes$:   Observable<Notificacao>                         = this.notificacoes$$.asObservable();
  espBase$:        Observable<'online' | 'aguardando' | 'offline'> = this.espBase$$.asObservable();
  statusCaiaques$: Observable<StatusCaiaque[]>                     = this.statusCaiaques$$.asObservable();

  constructor() {
    this.carregarDoStorage();

    this.socket$ = webSocket<WsMensagem>({
      url: this.WS_URL,
      deserializer: msg => JSON.parse(msg.data) as WsMensagem,
      openObserver: {
        next: () => {
          this.connected$$.next(true);
          this.emitir('servidor', 'Servidor conectado', 'sucesso');
        }
      },
      closeObserver: {
        next: () => {
          this.connected$$.next(false);
          this.espBase$$.next('offline');
          this.emitir('servidor', 'Servidor desconectado', 'erro');
        }
      }
    });

    this.socket$.pipe(
      retry({
        delay: (_, tentativa) => {
          console.warn(`Reconectando (tentativa ${tentativa})...`);
          return timer(5000);
        }
      })
    ).subscribe({
      next: msg => {
        // Heartbeat da base ESP — independente de posição GPS
        if ('tipo' in msg) {
          if (msg.tipo === 'base') this.sinalizarBase();
          return;
        }

        const pos = msg;
        if (pos.id == null) return;

        // Posição do caiaque também confirma base ativa
        this.sinalizarBase();

        if (!this.kayaksConhecidos.has(pos.id)) {
          this.kayaksConhecidos.add(pos.id);
          this.emitir('caiaque', `Caiaque ${pos.id} conectado`, 'info');
        }

        const status: StatusCaiaque = {
          id:                pos.id,
          nome:              `Caiaque ${pos.id}`,
          temGPS:            pos.lat != null && pos.lng != null,
          ultimaAtualizacao: new Date(),
        };
        this.statusMap.set(pos.id, status);
        this.statusCaiaques$$.next([...this.statusMap.values()]);

        if (pos.lat == null || pos.lng == null) return;

        const agora           = Date.now();
        const sessaoExistente = this.estado.get(pos.id);

        if (sessaoExistente) {
          const dist = this.distanciaMetros(
            sessaoExistente.lat, sessaoExistente.lng, pos.lat, pos.lng
          );
          if (dist < this.DISTANCIA_MINIMA_M) return;
        }

        const hora = new Date(agora).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const novoPonto: PontoHistorico = { lat: pos.lat, lng: pos.lng, timestamp: agora };

        const novaSessao: SessaoCaiaque = {
          id:                pos.id,
          nome:              `Caiaque ${pos.id}`,
          lat:               pos.lat,
          lng:               pos.lng,
          ultimaAtualizacao: new Date(agora).toISOString(),
          rota:              [...(sessaoExistente?.rota ?? []), { lat: pos.lat, lng: pos.lng, hora }],
          historico:         [...(sessaoExistente?.historico ?? []), novoPonto],
          primeiroSinal:     sessaoExistente?.primeiroSinal ?? agora,
          ultimoSinal:       agora,
        };

        this.estado.set(pos.id, novaSessao);
        this.subject$$.next({ caiaques: [...this.estado.values()] });
        this.agendarSalvamento();
      },
      error: err => console.error('[WS] Erro:', err)
    });
  }

  private carregarDoStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const sessoes: SessaoCaiaque[] = JSON.parse(raw);
      sessoes.forEach(s => {
        this.estado.set(s.id, s);
        this.statusMap.set(s.id, {
          id: s.id,
          nome: s.nome,
          temGPS: true,
          ultimaAtualizacao: new Date(s.ultimoSinal),
        });
        this.kayaksConhecidos.add(s.id);
      });
      this.subject$$.next({ caiaques: [...this.estado.values()] });
      this.statusCaiaques$$.next([...this.statusMap.values()]);
    } catch (e) {
      console.warn('[Storage] Erro ao carregar sessões:', e);
    }
  }

  private agendarSalvamento(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this.estado.values()]));
      } catch (e) {
        console.warn('[Storage] Erro ao salvar sessões:', e);
      }
    }, this.DEBOUNCE_SAVE_MS);
  }

  private distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  public getSessao(id: number): SessaoCaiaque | undefined {
    return this.estado.get(id);
  }

  public limparSessoes(): void {
    this.estado.clear();
    this.statusMap.clear();
    this.kayaksConhecidos.clear();
    localStorage.removeItem(this.STORAGE_KEY);
    this.subject$$.next({ caiaques: [] });
    this.statusCaiaques$$.next([]);
  }

  private sinalizarBase(): void {
    this.espBase$$.next('online');
    if (this.baseTimer) clearTimeout(this.baseTimer);
    this.baseTimer = setTimeout(() => this.espBase$$.next('offline'), 120_000);
  }

  private emitir(tipo: Notificacao['tipo'], mensagem: string, cor: Notificacao['cor']): void {
    this.notificacoes$$.next({ id: ++this.notifId, tipo, mensagem, cor });
  }

  ngOnDestroy(): void {
    if (this.baseTimer) clearTimeout(this.baseTimer);
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.socket$.complete();
  }
}

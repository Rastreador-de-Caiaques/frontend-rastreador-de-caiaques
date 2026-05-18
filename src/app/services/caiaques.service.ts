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

export interface Caiaque {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  ultimaAtualizacao: string;
  rota: PontoRota[];
}

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

interface PosicaoDto {
  id: number;
  lat: number | null;
  lng: number | null;
}

@Injectable({ providedIn: 'root' })
export class CaiaqueService implements OnDestroy {

  private readonly WS_URL = environment.backendWsUrl;
  private socket$: WebSocketSubject<PosicaoDto>;

  private estado       = new Map<number, Caiaque>();
  private statusMap    = new Map<number, StatusCaiaque>();
  private kayaksConhecidos = new Set<number>();
  private notifId      = 0;
  private baseTimer: ReturnType<typeof setTimeout> | null = null;

  private subject$$        = new BehaviorSubject<CaiaqueResponse>({ caiaques: [] });
  private connected$$      = new BehaviorSubject<boolean>(false);
  private notificacoes$$   = new Subject<Notificacao>();
  private espBase$$        = new BehaviorSubject<'online' | 'aguardando' | 'offline'>('aguardando');
  private statusCaiaques$$ = new BehaviorSubject<StatusCaiaque[]>([]);

  caiaques$:       Observable<CaiaqueResponse>                       = this.subject$$.asObservable();
  connected$:      Observable<boolean>                               = this.connected$$.asObservable();
  notificacoes$:   Observable<Notificacao>                           = this.notificacoes$$.asObservable();
  espBase$:        Observable<'online' | 'aguardando' | 'offline'>   = this.espBase$$.asObservable();
  statusCaiaques$: Observable<StatusCaiaque[]>                       = this.statusCaiaques$$.asObservable();

  constructor() {
    this.socket$ = webSocket<PosicaoDto>({
      url: this.WS_URL,
      deserializer: msg => JSON.parse(msg.data) as PosicaoDto,
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
      next: pos => {
        if (pos.id == null) return;

        // Sinaliza base ESP ativa e reinicia o timer de inatividade
        this.espBase$$.next('online');
        if (this.baseTimer) clearTimeout(this.baseTimer);
        this.baseTimer = setTimeout(() => this.espBase$$.next('offline'), 120_000);

        // Notifica novo caiaque (mesmo sem GPS)
        if (!this.kayaksConhecidos.has(pos.id)) {
          this.kayaksConhecidos.add(pos.id);
          this.emitir('caiaque', `Caiaque ${pos.id} conectado`, 'info');
        }

        // Atualiza status do caiaque
        const status: StatusCaiaque = {
          id:               pos.id,
          nome:             `Caiaque ${pos.id}`,
          temGPS:           pos.lat != null && pos.lng != null,
          ultimaAtualizacao: new Date(),
        };
        this.statusMap.set(pos.id, status);
        this.statusCaiaques$$.next([...this.statusMap.values()]);

        // Atualiza posição no mapa apenas com GPS válido
        if (pos.lat == null || pos.lng == null) return;

        this.estado.set(pos.id, {
          id:                pos.id,
          nome:              `Caiaque ${pos.id}`,
          lat:               pos.lat,
          lng:               pos.lng,
          ultimaAtualizacao: new Date().toISOString(),
          rota:              this.estado.get(pos.id)?.rota ?? []
        });

        this.subject$$.next({ caiaques: [...this.estado.values()] });
      },
      error: err => console.error('[WS] Erro:', err)
    });
  }

  private emitir(tipo: Notificacao['tipo'], mensagem: string, cor: Notificacao['cor']): void {
    this.notificacoes$$.next({ id: ++this.notifId, tipo, mensagem, cor });
  }

  ngOnDestroy(): void {
    if (this.baseTimer) clearTimeout(this.baseTimer);
    this.socket$.complete();
  }
}

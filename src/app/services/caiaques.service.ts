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

  private estado = new Map<number, Caiaque>();
  private kayaksConhecidos = new Set<number>();
  private notifId = 0;

  private subject$$      = new BehaviorSubject<CaiaqueResponse>({ caiaques: [] });
  private connected$$    = new BehaviorSubject<boolean>(false);
  private notificacoes$$ = new Subject<Notificacao>();

  caiaques$:     Observable<CaiaqueResponse> = this.subject$$.asObservable();
  connected$:    Observable<boolean>         = this.connected$$.asObservable();
  notificacoes$: Observable<Notificacao>     = this.notificacoes$$.asObservable();

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

        // Notifica qualquer caiaque novo, mesmo sem GPS ainda
        if (!this.kayaksConhecidos.has(pos.id)) {
          this.kayaksConhecidos.add(pos.id);
          this.emitir('caiaque', `Caiaque ${pos.id} conectado`, 'info');
        }

        // Só atualiza o mapa se tiver coordenadas válidas
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
    this.socket$.complete();
  }
}

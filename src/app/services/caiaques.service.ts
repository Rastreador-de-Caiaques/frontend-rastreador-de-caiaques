import { Injectable, OnDestroy } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, timer } from 'rxjs';
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

interface PosicaoDto {
  id: number;
  lat: number | null;
  lng: number | null;
}

@Injectable({ providedIn: 'root' })
export class CaiaqueService implements OnDestroy {

  private readonly WS_URL = environment.backendWsUrl;

  private socket$: WebSocketSubject<PosicaoDto>;

  // Estado interno: um Map por ID de caiaque
  private estado = new Map<number, Caiaque>();
  private subject$$ = new BehaviorSubject<CaiaqueResponse>({ caiaques: [] });

  caiaques$: Observable<CaiaqueResponse> = this.subject$$.asObservable();

  constructor() {
    this.socket$ = webSocket<PosicaoDto>({
      url: this.WS_URL,
      deserializer: msg => {
        console.log('[LoRa] Raw:', msg.data); // string bruta antes do parse
        return JSON.parse(msg.data) as PosicaoDto;
      }
    });

    this.socket$.pipe(
      retry({
        delay: (_, tentativa) => {
          console.warn(`Reconectando ao ESP32 (tentativa ${tentativa})...`);
          return timer(5000);
        }
      })
    ).subscribe({
      next: pos => {
        console.log('[LoRa] Recebido:', pos); // objeto já parseado

        if (pos.id == null || pos.lat == null || pos.lng == null) return;

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

  ngOnDestroy(): void {
    this.socket$.complete();
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class CaiaqueService {

  private readonly API_URL = 'assets/mock/caiaques.json';
  private readonly POLLING_INTERVAL = 10000;

  caiaques$: Observable<CaiaqueResponse>;

  constructor(private http: HttpClient) {
    this.caiaques$ = timer(0, this.POLLING_INTERVAL).pipe(
      switchMap(() => this.http.get<CaiaqueResponse>(this.API_URL)),
      shareReplay(1)
    );
  }
}
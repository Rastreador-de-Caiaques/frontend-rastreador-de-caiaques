import { Injectable, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FonteCadastroFirestore } from './cadastro-firestore';

export interface ConfigCadastro {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface CaiaqueCadastro {
  id: string;
  nome: string;
  deviceId: number | null;
}

export interface PasseioAtivo {
  caiaqueId: string;
  clienteNome: string;
}

export interface DadosCadastro {
  caiaques: CaiaqueCadastro[];
  passeiosAtivos: PasseioAtivo[];
}

export interface FonteCadastro {
  conectar(email: string, senha: string): Promise<void>;
  observar(onDados: (dados: DadosCadastro) => void, onErro: (erro: unknown) => void): () => void;
}

/** Fonte do cadastro (Firestore). `null` quando o cadastro não está configurado: o rastreador funciona sozinho. */
export const FONTE_CADASTRO = new InjectionToken<FonteCadastro | null>('FONTE_CADASTRO', {
  providedIn: 'root',
  factory: () => (environment.cadastro ? new FonteCadastroFirestore(environment.cadastro) : null),
});

/** "Nome — Cliente" com passeio em andamento, "Nome" sem passeio; caiaques sem deviceId são ignorados. */
export function montarRotulos(dados: DadosCadastro): Map<number, string> {
  const clientePorCaiaque = new Map(dados.passeiosAtivos.map(p => [p.caiaqueId, p.clienteNome]));
  const rotulos = new Map<number, string>();
  for (const c of dados.caiaques) {
    if (c.deviceId == null) continue;
    const cliente = clientePorCaiaque.get(c.id);
    rotulos.set(c.deviceId, cliente ? `${c.nome} — ${cliente}` : c.nome);
  }
  return rotulos;
}

@Injectable({ providedIn: 'root' })
export class CadastroService {
  private readonly fonte = inject(FONTE_CADASTRO);
  private readonly rotulos$$ = new BehaviorSubject<Map<number, string>>(new Map());
  private readonly conectado$$ = new BehaviorSubject(false);
  private parar: (() => void) | null = null;

  readonly habilitado = this.fonte !== null;
  readonly rotulos$: Observable<Map<number, string>> = this.rotulos$$.asObservable();
  readonly conectado$: Observable<boolean> = this.conectado$$.asObservable();

  rotulo(id: number): string {
    return this.rotulos$$.value.get(id) ?? `Caiaque ${id}`;
  }

  async conectar(email: string, senha: string): Promise<void> {
    if (!this.fonte) throw new Error('Cadastro não configurado');
    await this.fonte.conectar(email, senha);
    this.parar?.();
    this.parar = this.fonte.observar(
      dados => {
        this.rotulos$$.next(montarRotulos(dados));
        this.conectado$$.next(true);
      },
      () => {
        this.rotulos$$.next(new Map());
        this.conectado$$.next(false);
      },
    );
  }
}

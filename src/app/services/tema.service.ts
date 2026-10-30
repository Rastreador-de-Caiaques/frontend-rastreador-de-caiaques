import { Injectable } from '@angular/core';

export type Tema = 'claro' | 'escuro';

const CHAVE = 'rastreador_tema';

/** Tema claro/escuro. Sem escolha salva, segue o aparelho; o botão grava a escolha e ela vale nas próximas visitas. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private escolhido: Tema | null = this.ler();

  constructor() {
    this.aplicar();
  }

  get atual(): Tema {
    return this.escolhido ?? (this.aparelhoEscuro() ? 'escuro' : 'claro');
  }

  alternar(): void {
    this.escolhido = this.atual === 'escuro' ? 'claro' : 'escuro';
    try { localStorage.setItem(CHAVE, this.escolhido); } catch { /* modo privado: vale só nesta visita */ }
    this.aplicar();
  }

  private aplicar(): void {
    const raiz = document.documentElement;
    if (this.escolhido) raiz.setAttribute('data-tema', this.escolhido);
    else raiz.removeAttribute('data-tema');
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', this.atual === 'escuro' ? '#0f1a24' : '#0077b6');
  }

  private ler(): Tema | null {
    try {
      const v = localStorage.getItem(CHAVE);
      return v === 'claro' || v === 'escuro' ? v : null;
    } catch {
      return null;
    }
  }

  private aparelhoEscuro(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

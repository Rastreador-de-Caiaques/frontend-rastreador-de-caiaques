import { TestBed } from '@angular/core/testing';
import { TemaService } from './tema.service';

describe('TemaService', () => {
  const raiz = document.documentElement;

  beforeEach(() => {
    localStorage.removeItem('rastreador_tema');
    raiz.removeAttribute('data-tema');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('rastreador_tema');
    raiz.removeAttribute('data-tema');
  });

  it('sem escolha salva não força tema (segue o aparelho)', () => {
    TestBed.inject(TemaService);
    expect(raiz.hasAttribute('data-tema')).toBeFalse();
  });

  it('alternar troca para o tema oposto ao atual e grava a escolha', () => {
    const servico = TestBed.inject(TemaService);
    const antes = servico.atual;

    servico.alternar();

    const depois = antes === 'escuro' ? 'claro' : 'escuro';
    expect(servico.atual).toBe(depois);
    expect(raiz.getAttribute('data-tema')).toBe(depois);
    expect(localStorage.getItem('rastreador_tema')).toBe(depois);
  });

  it('alternar duas vezes volta ao tema inicial', () => {
    const servico = TestBed.inject(TemaService);
    const antes = servico.atual;
    servico.alternar();
    servico.alternar();
    expect(servico.atual).toBe(antes);
  });

  it('aplica a escolha salva ao iniciar', () => {
    localStorage.setItem('rastreador_tema', 'escuro');
    const servico = TestBed.inject(TemaService);
    expect(servico.atual).toBe('escuro');
    expect(raiz.getAttribute('data-tema')).toBe('escuro');
  });

  it('ignora valor salvo inválido', () => {
    localStorage.setItem('rastreador_tema', 'roxo');
    TestBed.inject(TemaService);
    expect(raiz.hasAttribute('data-tema')).toBeFalse();
  });
});

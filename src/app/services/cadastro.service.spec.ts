import { TestBed } from '@angular/core/testing';
import {
  CadastroService,
  DadosCadastro,
  FONTE_CADASTRO,
  FonteCadastro,
  montarRotulos,
} from './cadastro.service';

const dados: DadosCadastro = {
  caiaques: [
    { id: 'a', nome: 'Canoa Azul', deviceId: 7 },
    { id: 'b', nome: 'Canoa Verde', deviceId: 8 },
    { id: 'c', nome: 'Sem rádio', deviceId: null },
  ],
  passeiosAtivos: [{ caiaqueId: 'a', clienteNome: 'João' }],
};

describe('montarRotulos', () => {
  it('junta caiaque e cliente do passeio em andamento', () => {
    expect(montarRotulos(dados).get(7)).toBe('Canoa Azul — João');
  });

  it('usa só o nome do caiaque sem passeio em andamento', () => {
    expect(montarRotulos(dados).get(8)).toBe('Canoa Verde');
  });

  it('ignora caiaque sem deviceId', () => {
    expect(montarRotulos(dados).size).toBe(2);
  });
});

describe('CadastroService', () => {
  function criar(fonte: FonteCadastro | null): CadastroService {
    TestBed.configureTestingModule({ providers: [{ provide: FONTE_CADASTRO, useValue: fonte }] });
    return TestBed.inject(CadastroService);
  }

  it('sem cadastro configurado, mostra "Caiaque N" e não conecta', async () => {
    const service = criar(null);
    expect(service.habilitado).toBeFalse();
    expect(service.rotulo(7)).toBe('Caiaque 7');
    await expectAsync(service.conectar('a@b.c', 'x')).toBeRejected();
  });

  it('depois de conectar, usa os nomes do cadastro', async () => {
    const service = criar({
      conectar: async () => {},
      observar: onDados => { onDados(dados); return () => {}; },
    });
    await service.conectar('a@b.c', 'x');
    expect(service.rotulo(7)).toBe('Canoa Azul — João');
    expect(service.rotulo(99)).toBe('Caiaque 99');
  });

  it('se o cadastro der erro, volta para "Caiaque N"', async () => {
    let falhar: (e: unknown) => void = () => {};
    const service = criar({
      conectar: async () => {},
      observar: (onDados, onErro) => { onDados(dados); falhar = onErro; return () => {}; },
    });
    await service.conectar('a@b.c', 'x');
    falhar(new Error('offline'));
    expect(service.rotulo(7)).toBe('Caiaque 7');
  });

  it('login recusado não derruba o rastreador', async () => {
    const service = criar({
      conectar: async () => { throw new Error('auth/invalid-credential'); },
      observar: () => () => {},
    });
    await expectAsync(service.conectar('a@b.c', 'errada')).toBeRejected();
    expect(service.rotulo(7)).toBe('Caiaque 7');
  });
});

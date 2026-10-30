import {
  ENCERRA_AUTOMATICO_MS,
  estadoSinal,
  textoHa,
} from './estado-sinal';

const AGORA = 1_000_000_000_000;
const seg = (n: number) => n * 1000;
const min = (n: number) => n * 60_000;

describe('estadoSinal', () => {
  it('é "ao-vivo" até 30 s do último sinal, inclusive', () => {
    expect(estadoSinal(AGORA, AGORA)).toBe('ao-vivo');
    expect(estadoSinal(AGORA - seg(30), AGORA)).toBe('ao-vivo');
  });

  it('é "fraco" entre 30 s e 2 min, inclusive', () => {
    expect(estadoSinal(AGORA - seg(31), AGORA)).toBe('fraco');
    expect(estadoSinal(AGORA - min(2), AGORA)).toBe('fraco');
  });

  it('é "sem-sinal" depois de 2 min', () => {
    expect(estadoSinal(AGORA - min(2) - 1, AGORA)).toBe('sem-sinal');
    expect(estadoSinal(AGORA - min(29), AGORA)).toBe('sem-sinal');
  });

  it('é "encerrado" depois do prazo de encerramento automático', () => {
    expect(estadoSinal(AGORA - ENCERRA_AUTOMATICO_MS, AGORA)).toBe('sem-sinal');
    expect(estadoSinal(AGORA - ENCERRA_AUTOMATICO_MS - 1, AGORA)).toBe('encerrado');
  });

  it('relógio do aparelho atrasado em relação ao último sinal não vira alerta', () => {
    expect(estadoSinal(AGORA + seg(5), AGORA)).toBe('ao-vivo');
  });
});

describe('textoHa', () => {
  it('diz "agora" nos primeiros 10 s', () => {
    expect(textoHa(AGORA - seg(4), AGORA)).toBe('agora');
  });

  it('usa segundos até 1 min', () => {
    expect(textoHa(AGORA - seg(45), AGORA)).toBe('há 45 s');
  });

  it('usa minutos até 1 h', () => {
    expect(textoHa(AGORA - min(8), AGORA)).toBe('há 8 min');
  });

  it('usa horas depois de 1 h', () => {
    expect(textoHa(AGORA - min(125), AGORA)).toBe('há 2 h');
  });

  it('não mostra tempo negativo', () => {
    expect(textoHa(AGORA + seg(30), AGORA)).toBe('agora');
  });
});

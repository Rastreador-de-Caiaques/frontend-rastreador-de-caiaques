export type EstadoSinal = 'ao-vivo' | 'fraco' | 'sem-sinal' | 'encerrado';

/** O transmissor envia a cada 5 s; os limites dão folga para pacotes perdidos no rádio. */
export const LIMITE_AO_VIVO_MS = 30_000;
export const LIMITE_FRACO_MS = 120_000;
/** Sem sinal por mais que isso, o passeio é considerado encerrado e sai do mapa. */
export const ENCERRA_AUTOMATICO_MS = 30 * 60_000;
/** Ao abrir a página, sessões mais velhas que isso (de outro dia) são descartadas. */
export const DESCARTE_AO_ABRIR_MS = 12 * 30 * 60_000;

export function estadoSinal(ultimoSinal: number, agora: number): EstadoSinal {
  const decorrido = agora - ultimoSinal;
  if (decorrido <= LIMITE_AO_VIVO_MS) return 'ao-vivo';
  if (decorrido <= LIMITE_FRACO_MS) return 'fraco';
  if (decorrido <= ENCERRA_AUTOMATICO_MS) return 'sem-sinal';
  return 'encerrado';
}

export function textoHa(ultimoSinal: number, agora: number): string {
  const s = Math.floor(Math.max(0, agora - ultimoSinal) / 1000);
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)} h`;
}

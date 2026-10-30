import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CRIAR_SOCKET, CaiaqueService, Caiaque, Notificacao } from './caiaques.service';

const MIN = 60_000;
const T0 = 1_800_000_000_000;

type Observador = { next(e?: unknown): void };
let configSocket: { openObserver?: Observador; closeObserver?: Observador };

/** Socket falso: nenhum teste abre conexão de rede; guarda a config para simular abrir/cair. */
const SOCKET_FALSO = {
  provide: CRIAR_SOCKET,
  useValue: (config: typeof configSocket) => { configSocket = config; return new Subject(); },
};
const abrirConexao = () => configSocket.openObserver!.next();
const derrubarConexao = () => configSocket.closeObserver!.next();

beforeEach(() => TestBed.configureTestingModule({ providers: [SOCKET_FALSO] }));

describe('CaiaqueService — sinal dos caiaques', () => {
  let agora: number;
  let service: CaiaqueService;
  let ultimos: Caiaque[];
  let avisos: Notificacao[];

  const pacote = (id: number, lat: number | null = -23.96, lng: number | null = -46.33) =>
    ({ id, lat, lng });
  const reavaliar = () => (service as unknown as { reavaliar(): void }).reavaliar();
  const avancar = (ms: number) => { agora += ms; reavaliar(); };

  function criar(conectar = true): void {
    service = TestBed.inject(CaiaqueService);
    service.caiaques$.subscribe(r => (ultimos = r.caiaques));
    service.notificacoes$.subscribe(n => { if (n.tipo === 'caiaque') avisos.push(n); });
    if (conectar) abrirConexao();
  }

  beforeEach(() => {
    agora = T0;
    ultimos = [];
    avisos = [];
    localStorage.removeItem('rastreador_sessoes');
    spyOn(Date, 'now').and.callFake(() => agora);
  });

  afterEach(() => {
    TestBed.resetTestingModule(); // destrói o serviço: para o timer e fecha o WebSocket
    localStorage.removeItem('rastreador_sessoes');
  });

  it('caiaque que para de enviar vira "sem-sinal" mas continua no mapa', () => {
    criar();
    service.receber(pacote(1));
    expect(ultimos[0].estado).toBe('ao-vivo');

    avancar(10 * MIN);

    expect(ultimos.length).toBe(1);
    expect(ultimos[0].estado).toBe('sem-sinal');
  });

  it('passa por "fraco" antes de "sem-sinal"', () => {
    criar();
    service.receber(pacote(1));
    avancar(60_000);
    expect(ultimos[0].estado).toBe('fraco');
  });

  it('avisa uma única vez quando perde o sinal e avisa quando volta', () => {
    criar();
    service.receber(pacote(1));
    avancar(3 * MIN);
    avancar(5_000);
    expect(avisos.filter(a => a.cor === 'erro').length).toBe(1);

    service.receber(pacote(1, -23.9601, -46.3301));
    avancar(5_000);
    expect(ultimos[0].estado).toBe('ao-vivo');
    expect(avisos.some(a => a.cor === 'sucesso' && a.mensagem.includes('voltou'))).toBeTrue();
  });

  it('caiaque parado, mas enviando, não vira "sem-sinal"', () => {
    criar();
    service.receber(pacote(1));
    for (let i = 0; i < 12; i++) {
      agora += 20_000;
      service.receber(pacote(1)); // mesma posição: menos de 5 m
      reavaliar();
    }
    expect(ultimos[0].estado).toBe('ao-vivo');
  });

  it('depois de 30 min sem sinal o caiaque sai do mapa', () => {
    criar();
    service.receber(pacote(1));
    service.receber(pacote(2));
    avancar(31 * MIN);
    expect(ultimos.length).toBe(0);
  });

  it('só some quem passou do prazo', () => {
    criar();
    service.receber(pacote(1));
    avancar(20 * MIN);
    service.receber(pacote(2, -23.97, -46.34));
    avancar(15 * MIN);
    expect(ultimos.map(c => c.id)).toEqual([2]);
  });

  it('encerrarPasseio tira o caiaque do mapa; se voltar a enviar, reaparece', () => {
    criar();
    service.receber(pacote(1));
    service.encerrarPasseio(1);
    expect(ultimos.length).toBe(0);

    service.receber(pacote(1));
    expect(ultimos.length).toBe(1);
  });

  it('servidor desconectado: ninguém vira "sem-sinal" e nada é avisado', () => {
    criar();
    service.receber(pacote(1));
    derrubarConexao();

    avancar(10 * MIN);

    expect(ultimos[0].estado).toBe('ao-vivo');
    expect(avisos.filter(a => a.cor === 'erro').length).toBe(0);
  });

  it('ao reconectar, não dispara alerta antes de dar tempo dos pacotes chegarem', () => {
    criar();
    service.receber(pacote(1));
    derrubarConexao();
    agora += 10 * MIN;
    abrirConexao();

    avancar(5_000);
    expect(avisos.filter(a => a.cor === 'erro').length).toBe(0);

    service.receber(pacote(1, -23.9601, -46.3301)); // o caiaque continua enviando
    avancar(5_000);
    expect(ultimos[0].estado).toBe('ao-vivo');
  });

  it('antes de conectar, sessões restauradas não geram alerta', () => {
    localStorage.setItem('rastreador_sessoes', JSON.stringify([{
      id: 1, nome: 'Caiaque 1', lat: -23.96, lng: -46.33,
      ultimaAtualizacao: new Date(T0 - 10 * MIN).toISOString(),
      rota: [], historico: [], primeiroSinal: T0 - 20 * MIN, ultimoSinal: T0 - 10 * MIN,
    }]));
    criar(false);

    avancar(MIN);

    expect(ultimos[0].estado).toBe('sem-sinal');
    expect(avisos.length).toBe(0);
  });

  it('pacote sem GPS não renova o sinal da posição', () => {
    criar();
    service.receber(pacote(1));
    agora += 3 * MIN;
    service.receber(pacote(1, null, null));
    reavaliar();
    expect(ultimos[0].estado).toBe('sem-sinal');
  });
});

describe('CaiaqueService — ao reabrir a página', () => {
  const sessao = (id: number, ultimoSinal: number) => ({
    id, nome: `Caiaque ${id}`, lat: -23.96, lng: -46.33,
    ultimaAtualizacao: new Date(ultimoSinal).toISOString(),
    rota: [], historico: [], primeiroSinal: ultimoSinal - MIN, ultimoSinal,
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('rastreador_sessoes');
  });

  it('não restaura caiaques de outro passeio (mais de 30 min sem sinal)', () => {
    const agora = T0;
    spyOn(Date, 'now').and.returnValue(agora);
    localStorage.setItem('rastreador_sessoes', JSON.stringify([
      sessao(1, agora - 3 * 60 * MIN),
      sessao(2, agora - 5 * MIN),
    ]));

    const service = TestBed.inject(CaiaqueService);
    let ids: number[] = [];
    service.caiaques$.subscribe(r => (ids = r.caiaques.map(c => c.id)));

    expect(ids).toEqual([2]);
  });
});

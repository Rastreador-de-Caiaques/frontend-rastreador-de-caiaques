import type { ConfigCadastro, DadosCadastro, FonteCadastro } from './cadastro.service';

/** Leitura do Firestore (somente leitura). O SDK do Firebase é importado sob demanda. */
export class FonteCadastroFirestore implements FonteCadastro {
  constructor(private readonly config: ConfigCadastro) {}

  private async iniciar() {
    const { getApp, getApps, initializeApp } = await import('firebase/app');
    return getApps().length ? getApp() : initializeApp(this.config);
  }

  async conectar(email: string, senha: string): Promise<void> {
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(getAuth(await this.iniciar()), email, senha);
  }

  observar(onDados: (dados: DadosCadastro) => void, onErro: (erro: unknown) => void): () => void {
    let encerrado = false;
    const cancelar: Array<() => void> = [];

    void (async () => {
      try {
        const { getFirestore, collection, onSnapshot } = await import('firebase/firestore');
        const db = getFirestore(await this.iniciar());
        if (encerrado) return;

        let clientes = new Map<string, string>();
        let caiaques: DadosCadastro['caiaques'] = [];
        let passeios: Array<{ caiaqueId: string; clienteId: string }> = [];
        const emitir = () =>
          onDados({
            caiaques,
            passeiosAtivos: passeios.map(p => ({
              caiaqueId: p.caiaqueId,
              clienteNome: clientes.get(p.clienteId) ?? '',
            })).filter(p => p.clienteNome),
          });

        cancelar.push(
          onSnapshot(collection(db, 'clientes'), snap => {
            clientes = new Map(snap.docs.map(d => [d.id, String(d.get('nome') ?? '')]));
            emitir();
          }, onErro),
          onSnapshot(collection(db, 'caiaques'), snap => {
            caiaques = snap.docs.map(d => ({
              id: d.id,
              nome: String(d.get('nome') ?? ''),
              deviceId: typeof d.get('deviceId') === 'number' ? d.get('deviceId') : null,
            }));
            emitir();
          }, onErro),
          onSnapshot(collection(db, 'passeios'), snap => {
            passeios = snap.docs
              .filter(d => d.get('estado') === 'em_andamento')
              .map(d => ({ caiaqueId: d.get('caiaqueRef')?.id ?? '', clienteId: d.get('clienteRef')?.id ?? '' }));
            emitir();
          }, onErro),
        );
      } catch (erro) {
        onErro(erro);
      }
    })();

    return () => {
      encerrado = true;
      cancelar.forEach(c => c());
    };
  }
}

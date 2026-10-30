import type { ConfigCadastro } from '../app/services/cadastro.service'

export const environment: { production: boolean; backendWsUrl: string; cadastro: ConfigCadastro | null } = {
  production: false,
  backendWsUrl: 'ws://localhost:3000/ws',
  // Cadastro (Firebase) é opcional. Preencha apenas para mostrar nomes de caiaques e clientes no mapa.
  cadastro: null,
}

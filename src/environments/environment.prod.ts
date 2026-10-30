import type { ConfigCadastro } from '../app/services/cadastro.service'

export const environment: { production: boolean; backendWsUrl: string; cadastro: ConfigCadastro | null } = {
  production: true,
  // Substitua pela URL do seu backend no Railway após o deploy
  backendWsUrl: 'wss://rastreador-de-caiaques.onrender.com/ws',
  // Cadastro (Firebase) é opcional. Preencha apenas para mostrar nomes de caiaques e clientes no mapa.
  cadastro: null,
}

# Rastreador de Caiaques — Dashboard Frontend

Dashboard web em tempo real para monitoramento da frota de caiaques da **Xtreme Caiaques**. Esta interface web consome dados de geolocalização processados e expostos pelo Backend via WebSockets e APIs REST, renderizando-os em um mapa interativo e painéis informativos para os operadores da base.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Funcionalidades Principais](#funcionalidades-principais)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Pré-requisitos](#pré-requisitos)
6. [Instalação e Execução Local](#instalação-e-execução-local)
7. [Configuração de Ambientes (API & WebSocket)](#configuração-de-ambientes-api--websocket)
8. [Integração e Comunicação (WebSockets)](#integração-e-comunicação-websockets)
9. [Testes](#testes)

---

## Visão Geral

O frontend é a camada de apresentação do sistema de rastreamento de caiaques, permitindo ao usuário/operador visualizar:

```
Dashboard Web (este projeto — Angular)
        ↑ (WebSocket / HTTP REST)
Backend API (NestJS + Prisma)
        ↑
Estação Base (ESP32 + LoRa)
        ↑
Hardware Embarcado (Arduino + GPS + LoRa)
```

Toda a atualização de posições, sinalizações de conectividade dos dispositivos e notificações de alertas de status ocorrem de maneira reativa, sem a necessidade de atualizar a página, proporcionando um monitoramento preciso e imediato da frota.

---

## Stack Tecnológica

| Tecnologia | Versão | Função |
|---|---|---|
| Angular | 20.3 | Framework web de componentes e injeção de dependência |
| TypeScript | 5.9 | Linguagem estática para tipagem robusta e segurança de código |
| Leaflet | 1.9 | Biblioteca leve para renderização e controle do mapa interativo |
| RxJS | 7.8 | Programação reativa para manipulação de Streams de WebSockets e estados |
| SCSS | - | Pré-processador CSS para design responsivo e micro-animações customizadas |
| Karma + Jasmine | - | Ferramentas padrão para execução e especificação de testes unitários |

---

## Funcionalidades Principais

- **🗺️ Mapa Interativo Real-Time:** Renderização fluida da localização geográfica atualizada de cada caiaque ativo no mapa utilizando Leaflet.
- **🛰️ Indicador de Base (ESP32 Gateway):** Exibição em tempo real do status de conexão da Estação Base LoRa (Online, Aguardando Sinal, Offline).
- **📈 Histórico de Rotas (Trilha de Navegação):** Desenho em mapa do traçado de rotas anteriores dos caiaques para acompanhamento de trajetórias.
- **🔋 Informações e Métricas Individuais:** Painel lateral dinâmico para acompanhamento de velocidade (km/h), nível de bateria da embarcação e status.
- **🔔 Central de Notificações Ativas:** Micro-notificações com tempo de exibição e transições suaves de fade-out informando quando novos caiaques são detectados ou se o servidor cair.

---

## Estrutura de Pastas

A estrutura base da aplicação Angular é modularizada de forma focada e limpa:

```
frontend/
├── public/                         # Assets estáticos (favicon, ícones globais)
│
├── src/
│   ├── main.ts                     # Ponto de entrada do bootstrapping do Angular
│   ├── index.html                  # HTML base contendo os fontes do Google Fonts e Leaflet CSS
│   ├── styles.scss                 # Estilos globais da aplicação e micro-animações do mapa (pulsos)
│   │
│   ├── app/
│   │   ├── app.config.ts           # Configurações globais de injeção de dependência
│   │   ├── app.ts                  # Componente Root da aplicação
│   │   ├── app.html                # Template do componente root chamando a tag do mapa
│   │   │
│   │   ├── services/
│   │   │   └── caiaques.service.ts # Serviços de stream de dados via WebSocket reativo
│   │   │
│   │   ├── mapa/                   # Componente Principal da visualização
│   │   │   ├── mapa.ts             # Lógica do mapa Leaflet e controle de marcadores/camadas
│   │   │   ├── mapa.html           # Template da visualização e blocos de painéis/notificações
│   │   │   └── mapa.scss           # Estilo local com transições
│   │   │
│   │   ├── painel-caiaque/         # Componente de detalhes do caiaque selecionado
│   │   │   ├── painel-caiaque.ts   # Apresentação do nível de bateria e velocidade
│   │   │   └── painel-caiaque.html
│   │   │
│   │   └── painel-status/          # Componente de status geral de conexão e frota
│   │       ├── painel-status.ts    # Listagem de caiaques conectados e se possuem sinal de GPS
│   │       └── painel-status.html
│   │
│   └── environments/               # Arquivos de configurações de ambiente e URLs
│       ├── environment.ts          # Desenvolvimento local
│       └── environment.prod.ts     # Produção (Vercel)
```

---

## Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- npm (gerenciador de pacotes, padrão do Node.js)
- [Backend rodando localmente](https://github.com/Rastreador-de-Caiaques/backend-rastreador-de-caiaques) (ou exposto em nuvem)

---

## Instalação e Execução Local

### 1. Instalar as dependências

Abra o terminal na pasta do projeto frontend e execute:

```bash
npm install
```

### 2. Rodar o servidor de desenvolvimento

Inicie o servidor de desenvolvimento local do Angular:

```bash
npm start
```

### 3. Acessar a aplicação

Uma vez iniciado, abra o navegador e acesse:

```
http://localhost:4200
```

*A página irá recarregar automaticamente sempre que você modificar qualquer arquivo de origem do código.*

---

## Configuração de Ambientes (API & WebSocket)

O dashboard precisa saber onde o backend está rodando. Esta configuração é realizada nos arquivos localizados em `src/environments/`:

### Desenvolvimento Local (`src/environments/environment.ts`)
```typescript
export const environment = {
  production: false,
  backendWsUrl: 'ws://localhost:3001/ws' // Endereço WebSocket do servidor local
};
```

### Produção (`src/environments/environment.prod.ts`)
```typescript
export const environment = {
  production: true,
  backendWsUrl: 'wss://seu-backend-producao.render.com/ws' // Endereço WebSocket de produção
};
```

---

## Integração e Comunicação (WebSockets)

O fluxo de dados da aplicação funciona de forma reativa e sob demanda através da classe `CaiaqueService` (`src/app/services/caiaques.service.ts`).

O serviço utiliza a classe `webSocket` do RxJS para:
1. Conectar-se ao servidor na inicialização.
2. Emitir notificações imediatas se o servidor se desconectar ou conectar com sucesso.
3. Manter reconexão automática contínua (com tempo de retardo de 5 segundos) em caso de quedas indesejadas.
4. Processar mensagens contendo dados brutos de telemetria dos caiaques (`id`, `lat`, `lng`, `bat`, `vel`), atualizando e re-emitindo a lista de caiaques para todos os componentes assinantes de forma automática.

---

## Testes

O frontend conta com suporte a testes de unidade do Angular CLI. Para executar os testes usando o Karma:

```bash
# Executa a suíte de testes unitários
npm test
```

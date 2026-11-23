# Medical Eye

Ficha de avaliação de feridas para navegador e instalação como PWA. Pensada para profissionais, internos e estudantes em prática supervisionada.

- **Foto.** O WILLIE MINI roda localmente e sugere o tipo e o contorno. Com a chave e a autorização de envio, o Gemini descreve a foto e propõe achados em uma única chamada.
- **Exame.** O profissional revisa as sugestões. O tipo e os achados orientam o roteiro, que acompanha as correções registradas na consulta.
- **Conduta e tratamento.** O resumo reúne o exame, a hipótese, as pendências e as orientações aplicáveis, com as seções das diretrizes e estudos. A biblioteca permite buscar por tema e abrir os PDFs baixados no servidor.

## Rodar no Windows

Abra o Docker Desktop. No PowerShell, entre na pasta do repositório e crie o `.env` se for a primeira instalação.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Preencha `GEMINI_API_KEY` com uma chave do seu projeto no Google AI Studio. Em seguida, execute.

```powershell
docker compose up --build -d
docker compose ps
```

Abra [localhost:4310](http://localhost:4310). Na primeira inicialização, o WILLIE baixa os pesos oficiais e a biblioteca baixa os documentos na pasta `references/`. A ficha e a biblioteca podem ser abertas enquanto o WILLIE inicia. O Gemini usa `gemini-3.8-flash` por padrão.

```powershell
docker compose logs willie references
```

No Linux ou macOS, use `cp .env.example .env` se o arquivo ainda não existir.

## Instalar no celular

Abra a aplicação por HTTPS, com acesso restrito à equipe. No Android e no Chromium, use **Instalar**. No iPhone e no iPad, use **Compartilhar → Adicionar à Tela de Início** no Safari.

## Código e testes

| Pasta | Conteúdo |
| --- | --- |
| `web/` | Ficha, biblioteca, captura e PWA |
| `server/` | API, integração com os modelos e resumo local |
| `willie/` | Inferência local de classificação e segmentação em Python |
| `scripts/` | Download dos PDFs catalogados |
| `tests/` | Testes da API, do exame, das referências e da PWA |

Execute `npm test` com Node.js 22 ou superior. O teste da integração usa provedores controlados e verifica o número de chamadas ao Gemini.

O WILLIE é um modelo de pesquisa. O contorno é estimado e a aplicação precisa de validação clínica e institucional para uso assistencial. A ficha serve para revisão profissional.

[Arquitetura](docs/arquitetura.md) · [Configuração](docs/configuracao.md)

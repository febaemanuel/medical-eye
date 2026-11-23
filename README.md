# Medical Eye

Ficha web instalável para registro e revisão profissional da avaliação de feridas.

1. Capture ou selecione a foto. Uma chamada ao Gemini devolve o tipo sugerido e os achados visuais.
2. Preencha a consulta e o exame. As perguntas mudam conforme o tipo sugerido e o contexto clínico registrado. O botão **Consultar orientação** mostra uma síntese da seção pertinente de uma diretriz.
3. Revise o resumo com a hipótese clínica, os achados registrados, as pendências e as referências recuperadas na base local.

O tipo da foto é uma hipótese visual. O resumo considera história e exame, com critérios aplicáveis de estágio ou gravidade quando há dados suficientes. O uso assistencial exige validação clínica e institucional.

## Rodar no computador

Com Docker e Compose, copie o exemplo e preencha `GEMINI_API_KEY` no `.env`. Para uma instalação existente, preserve seu `.env`.

```bash
cp .env.example .env
docker compose up --build -d
```

No PowerShell, use `Copy-Item .env.example .env` para criar o arquivo pela primeira vez. Abra [localhost:4310](http://localhost:4310). O serviço principal usa `gemini-3.8-flash` por padrão e pode ser configurado com `VISION_MODEL`.

```bash
docker compose ps
docker compose logs -f web
```

## Instalar no celular

Sirva a aplicação na raiz de um domínio HTTPS com acesso restrito à equipe. No Android ou no Chromium, use **Instalar**. No iPhone e no iPad, use **Compartilhar → Adicionar à Tela de Início** no Safari.

## Código e testes

| Pasta | Conteúdo |
| --- | --- |
| `web/` | Ficha, captura, perguntas, fontes locais e shell da PWA |
| `server/` | API Node, análise com Gemini e geração do resumo a partir do exame |
| `willie/` | Serviço opcional para pesquisa e comparação de classificadores |
| `tests/` | Testes da API, referências clínicas, exame e PWA |

Execute `npm test` com Node.js 22 ou superior. O teste de integração conta as chamadas ao provedor usando respostas controladas.

[Arquitetura e fluxo de dados](docs/arquitetura.md) · [Configuração e publicação](docs/configuracao.md)

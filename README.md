# Medical Eye

Aplicativo web instalável de apoio à avaliação de feridas. Foi pensado para profissionais de saúde, internos e estudantes.

O caso começa com uma foto tirada pelo app ou selecionada na galeria. O WILLIE MINI sugere uma das cinco classes (`diabetic`, `pressure`, `surgical`, `venous` e `no_wound`), e o Gemini de visão descreve o que é possível observar. A equipe registra os achados do exame e revisa o parecer preliminar, que traz hipótese, estágio, gravidade da infecção, conduta sugerida e fontes. O app indica quando faltam dados para classificar.

O WILLIE é um modelo de pesquisa. O uso assistencial depende de validação clínica e institucional. [Repositório oficial](https://github.com/Qian-Group-HRI/Willie) · [Pesos e limitações](https://huggingface.co/QianGroup/willie-weights)

## Rodar no computador

Você precisa de Docker com Compose e de uma chave Gemini. Copie o exemplo e preencha `GEMINI_API_KEY` no `.env`.

```bash
cp .env.example .env
docker compose up --build -d
```

Abra [localhost:4310](http://localhost:4310). Na primeira execução, o classificador baixa cerca de 410 MB de pesos oficiais para o volume `willie-models`. O app fica disponível depois que o classificador carrega.

Use `docker compose ps` para ver se os serviços subiram e `docker compose logs -f willie web` para acompanhar a inicialização. Para encerrar, use `docker compose down`.

O modelo padrão é `gemini-3.8-flash`. As opções `VISION_MODEL` e `REPORT_MODEL` permitem escolher modelos diferentes para a foto e o parecer. [Documentação de imagens](https://ai.google.dev/gemini-api/docs/image-understanding) · [Saída em JSON](https://ai.google.dev/gemini-api/docs/structured-output)

## Instalar como aplicativo

- Android e desktop Chromium. Use **Instalar aplicativo** no app ou no menu do navegador.
- iPhone e iPad. No Safari, use **Compartilhar → Adicionar à Tela de Início**.

Para acessar pelo celular, sirva a aplicação na raiz de um domínio HTTPS com acesso restrito à equipe. O navegador pode guardar a interface e a biblioteca de protocolos para consulta, e as análises precisam de conexão.

## Código e documentação

| Pasta | O que tem |
| --- | --- |
| `web/` | Interface, câmera, formulários, manifesto e base de protocolos |
| `server/` | API Node, integração com o Gemini e busca de referências |
| `willie/` | Serviço Python do classificador e download dos pesos |
| `tests/` | Testes da API, do exame e dos arquivos da PWA |
| `docs/` | Configuração, arquitetura e tratamento dos dados |

Execute `npm test` com Node.js 22 ou superior. Os testes usam respostas controladas no lugar das chamadas aos provedores.

[Arquitetura e fluxo de dados](docs/arquitetura.md) · [Configuração e publicação](docs/configuracao.md)

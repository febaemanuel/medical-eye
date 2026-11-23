# Configuração

## Docker Compose

A interface publica a porta `4310` no computador. O Compose sobe o WILLIE na rede interna e guarda os pesos no volume `willie-models`. O serviço `references` baixa os PDFs catalogados para `references/` e encerra após a tarefa. A saída `Exited (0)` indica que o download terminou.

```powershell
docker compose logs willie references
docker compose run --rm references
```

O segundo comando baixa documentos que faltam ou ficaram incompletos. Se uma fonte estiver temporariamente inacessível, o app continua com as sínteses e os links originais.

## Rodar o servidor diretamente

Com Node.js 22 ou superior, execute `npm run references` e `npm start`. Configure `WILLIE_URL` para apontar para o serviço Python, se ele estiver em outro endereço. Por padrão o Node tenta `http://127.0.0.1:8765`. O exame pode ser preenchido manualmente se um dos modelos estiver temporariamente indisponível.

| Variável | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Credencial do projeto no Google AI Studio, mantida no servidor |
| `VISION_MODEL` | Identificador do Gemini para leitura visual. Padrão `gemini-3.8-flash` |
| `GEMINI_BASE_URL` | Gateway com contrato Gemini REST, quando necessário |
| `WILLIE_URL` | Endereço do serviço de inferência |
| `WILLIE_TOKEN` | Credencial opcional, compartilhada entre o servidor e o WILLIE |
| `REFERENCES_DIR` | Pasta de PDFs locais. Padrão `references/` na raiz do projeto |
| `PORT` | Porta do app. Padrão `4310` |
| `HOST` | Interface de rede do Node executado diretamente. Padrão `127.0.0.1` |

O endpoint `/api/config` retorna `geminiConfigured: true` quando a chave está definida. Para testar, use uma foto autorizada e confirme se a interface mostra a sugestão e, quando retornado pelo modelo, o contorno do WILLIE. Se autorizar o envio ao Gemini, confira os achados na aba **Achados**. No exame, marque uma pendência e abra a orientação correspondente.

## Acesso no celular e dados

Encaminhe a raiz de um domínio HTTPS para a porta publicada, com acesso restrito à equipe pela rede privada ou por autenticação no proxy. Câmera e instalação da PWA dependem de um contexto seguro no dispositivo.

O navegador reconstrói a imagem em JPEG, sem os metadados do arquivo original. O registro e a foto ficam em memória durante a sessão. A foto segue para o WILLIE após confirmação do processamento. O Gemini recebe a foto apenas quando a chave está definida e a ficha registra autorização específica para o envio. O questionário e o resumo permanecem no servidor do Medical Eye.

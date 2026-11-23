# Configuração e publicação

## Rodar com Node.js

Use a versão 22 ou superior. Copie o exemplo, preencha a chave no arquivo e inicie o servidor.

```bash
cp .env.example .env
npm start
```

## Configuração

| Variável | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Chave usada para analisar a foto |
| `VISION_MODEL` | Modelo Gemini que devolve classificação sugerida e achados em JSON |
| `GEMINI_BASE_URL` | Gateway com contrato Gemini REST, quando necessário. A API oficial é o padrão |
| `HOST` e `PORT` | Endereço e porta do Node em execução direta. Padrão `127.0.0.1:4310` |

No Compose, `PORT` define a porta publicada em loopback. Para acesso de outros dispositivos, encaminhe a raiz do domínio HTTPS para essa porta. Restrinja o acesso pelo provedor de identidade ou pela rede privada da instituição.

## Verificar a instalação

- Acesse `/api/config`. `configured: true` indica que a chave está definida.
- Teste com uma foto que você tem autorização para processar. Confira a classificação sugerida e os achados. Abra uma orientação, marque uma pendência e confirme se a fonte aparece no resumo.
- Verifique a instalação da PWA e a câmera nos dispositivos de uso.

## WILLIE para pesquisa

O serviço Python do WILLIE está no perfil `research` do Compose. Use `docker compose --profile research up --build -d willie` para iniciá-lo como serviço interno. Os pesos MINI oficiais são baixados no primeiro início para o volume `willie-models`. Em instalações anteriores, o comando `docker compose --profile research stop willie` para esse serviço opcional e preserva o volume.

## Dados e uso assistencial

A foto é enviada ao Gemini para a classificação sugerida e a leitura visual. O exame, a consulta às fontes e a geração do resumo ficam na aplicação. O service worker guarda apenas os arquivos da interface e a biblioteca de referências. A ficha fica em memória durante a sessão.

Antes de processar fotos de pacientes, confirme a autorização institucional para o uso da API externa, as condições de retenção do provedor e a validação clínica do fluxo e das referências.

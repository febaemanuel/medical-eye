# Configuração e publicação

## Sem Docker

Use Python 3.12, Node.js 22 ou superior e um ambiente virtual. No PowerShell, use `.venv\Scripts\python.exe` no lugar de `.venv/bin/python`.

```bash
python -m venv .venv
.venv/bin/python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.7.1+cpu'
.venv/bin/python -m pip install -r willie/requirements.txt
.venv/bin/python willie/scripts/fetch_models.py
.venv/bin/python -m uvicorn --app-dir willie service:app --host 127.0.0.1 --port 8765 --no-access-log
```

Em outro terminal, copie o exemplo e configure a credencial Gemini.

```bash
cp .env.example .env
npm start
```

## Configuração do servidor

| Variável | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Chave da conta que fará as chamadas de visão e parecer |
| `VISION_MODEL` e `REPORT_MODEL` | Identificadores Gemini disponíveis na conta |
| `GEMINI_BASE_URL` | URL HTTPS de um gateway próprio que implemente o mesmo contrato Gemini REST. O padrão é a API oficial |
| `WILLIE_URL` | Endpoint interno do classificador. O Compose configura `http://willie:8765/classify` |
| `WILLIE_TOKEN` | Token opcional entre a API e o classificador. Use o mesmo valor nos dois serviços |
| `WILLIE_THREADS` | Número de threads do PyTorch no serviço. Padrão 4 |
| `WILLIE_MODEL_DIR` | Pasta de pesos e código DINOv2 no serviço Python. Padrão local `.cache/willie` |
| `HOST` e `PORT` | Endereço e porta do Node em execução direta. Padrão `127.0.0.1:4310` |

No Compose, `PORT` é a porta publicada em loopback no host. Para o celular, configure o proxy HTTPS para encaminhar a raiz do domínio a essa porta. Controle o acesso ao domínio pelo provedor de identidade ou pela rede privada da instituição. Mantenha o WILLIE em rede interna e configure chaves no ambiente ou no gerenciador de segredos do servidor. Duas chamadas externas são feitas por avaliação completa.

## Verificar a instalação

- Confira se o WILLIE fica saudável com `docker compose ps`. Os logs do serviço mostram as etapas de download e inicialização.
- Abra `/api/config`. `configured: true` indica que o endpoint e a chave estão definidos. A validade da credencial é verificada pela primeira chamada real.
- Para o teste técnico inicial, use uma imagem que você está autorizado a processar. Veja o retorno do WILLIE e do Gemini, preencha o exame e confira as referências do parecer.
- Instale a PWA pelo navegador do dispositivo que será usado. Verifique a câmera e as permissões nesse dispositivo.

Em caso de erro Gemini, confira a chave, o identificador de modelo disponível e a cota da conta. Para falha no WILLIE, consulte a saúde do contêiner, o espaço disponível no volume e a conectividade na etapa de download.

## Dados e uso assistencial

O código do aplicativo mantém a foto e as respostas em memória. O service worker guarda somente arquivos públicos da interface e da base de referências. O app envia a foto e os achados aos serviços configurados conforme descrito na [arquitetura](arquitetura.md). Retenção e acesso no provedor externo e no proxy são definidos pelas respectivas configurações e contratos.

Antes de processar fotos de pacientes, valide a autorização institucional para o fluxo de dados e a política aplicável ao provedor, revise o protocolo local e valide o modelo e o parecer para o cenário de uso. O WILLIE MINI é um modelo de pesquisa, e o resultado precisa de revisão pelo profissional responsável. [Model card do WILLIE](https://huggingface.co/QianGroup/willie-weights)

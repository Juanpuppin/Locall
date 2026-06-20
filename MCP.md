# 🔌 MCP — Ligação Local

MCP server que controla o app de **chamada de voz por rede local** a partir de
qualquer sessão do Claude (Claude Code), em linguagem natural — iniciar, parar,
consultar status e pegar os endereços de acesso.

Arquivo: [`mcp-server.js`](mcp-server.js) · Node puro, **zero dependências** ·
JSON-RPC 2.0 sobre stdio.

---

## Como usar

Em **qualquer sessão** do Claude, basta pedir em português. Exemplos:

| Você diz… | Acontece |
|---|---|
| *"inicie a ligação local"* | Liga o servidor e devolve os endereços para abrir nos aparelhos |
| *"qual o endereço da ligação?"* | Mostra os links **sem** iniciar nada |
| *"a ligação está no ar?"* | Status: rodando? em que porta? qual PID? |
| *"encerre a ligação"* | Desliga o servidor e libera a porta |

> O servidor iniciado pelo MCP **continua rodando** mesmo depois que a sessão do
> Claude terminar — só para quando você mandar encerrar ou reiniciar o PC.

---

## Ferramentas (tools)

| Ferramenta | Argumentos | O que faz |
|---|---|---|
| `start_call` | — | Inicia o `server.js` (em segundo plano, desacoplado da sessão) e devolve os endereços. Se já estiver no ar, só devolve os links. |
| `stop_call` | — | Encerra o servidor e **espera a porta fechar de fato**. Acha o processo mesmo que tenha sido iniciado pelo `Iniciar Ligacao.bat` (via `netstat`). |
| `call_status` | — | Diz se está rodando, em que porta, qual PID e desde quando. |
| `get_urls` | — | Devolve só os endereços (URLs), sem iniciar nada. |

Todas as respostas vêm em texto pronto para ler, já com os endereços ordenados
(o IP `192.168.x.x` da Wi-Fi de casa vem primeiro) e o lembrete sobre o aviso
de certificado.

---

## Registro (já feito)

O MCP foi registrado no **escopo de usuário**, então vale para todas as sessões:

```
claude mcp add ligacao-local --scope user -- node "C:\Users\juanp\Documents\ligacao-local\mcp-server.js"
```

Conferir saúde:

```
claude mcp list
# ligacao-local: node C:\Users\juanp\Documents\ligacao-local\mcp-server.js - ✓ Connected
```

Remover:

```
claude mcp remove ligacao-local --scope user
```

> ⚠️ **Se mover a pasta de novo**, o caminho acima fica desatualizado. Refaça o
> `claude mcp add` com o novo caminho (remova antes, se quiser evitar duplicata).

---

## Comportamento e detalhes

- **Não inicia nada sozinho.** Carregar o MCP (no começo da sessão) só deixa as
  ferramentas disponíveis; o servidor de chamada só sobe quando você pede
  `start_call`.
- **Detecta servidor iniciado por fora.** Se você abriu pelo `Iniciar Ligacao.bat`,
  o `call_status` reconhece (checando a porta) e o `stop_call` consegue encerrar.
- **Porta.** Usa `8443` por padrão (mesma do `server.js`); respeita a variável de
  ambiente `PORT` se definida.
- **Estado.** Guarda qual processo iniciou em `.mcp-state.json` na pasta do projeto.
- **HTTPS.** O microfone do navegador só funciona em HTTPS (ou `localhost`), por
  isso o certificado local (`cert.pfx`). O aviso de "não confiável" é normal.

---

## Problemas comuns

| Sintoma | Causa provável / o que fazer |
|---|---|
| `claude mcp list` não mostra `ligacao-local` | O registro não foi feito nesse computador/usuário. Rode o `claude mcp add` acima. |
| Ferramentas não aparecem na sessão atual | Foi registrado durante a sessão — recarregue os MCPs ou abra uma sessão nova. |
| `start_call` diz que a porta não respondeu | Firewall do Windows bloqueando, ou geração do certificado demorando. Veja a seção **Firewall** no [README.md](README.md). |
| `stop_call`: "não consegui finalizar (precisa de admin)" | O servidor foi iniciado por outro usuário/processo elevado. Encerre pela janela (Ctrl+C) ou rode o Claude como admin. |
| Mudei a pasta e o MCP quebrou | Refaça o `claude mcp add` com o novo caminho. |

---

Veja também o [README.md](README.md) para o uso geral do app, a seção de
**Firewall** e os detalhes de rede.

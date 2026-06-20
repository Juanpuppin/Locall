# 📞 Locall

Chamada de voz pela rede Wi-Fi de casa, **sem internet e sem serviço de terceiros**.
O áudio vai direto de um aparelho para o outro (WebRTC); o servidor só apresenta
a página e ajuda os dois a se encontrarem.

A interface é um app **React + TypeScript** (em `client/`); o `server.js` serve o
build pronto e faz a sinalização. Veja **Interface (React)** abaixo para desenvolver.

## Como usar

1. **No seu PC**: dê dois cliques em `Iniciar Ligacao.bat`
   (ou rode `node server.js` na pasta).
   - Na primeira vez, o Windows pode perguntar se o Node pode usar a rede —
     clique em **Permitir** (rede privada).
2. O servidor mostra um endereço tipo `https://192.168.0.10:8443`.
3. **Nos dois aparelhos** (seu e o dela, no mesmo Wi-Fi): abra esse endereço
   no navegador.
   - O navegador vai avisar que o certificado não é confiável. É normal —
     o certificado é gerado localmente. Para prosseguir:
     - **Chrome/Edge (PC e Android)**: "Avançado" → "Ir para … (não seguro)"
     - **Safari (iPhone)**: "Mostrar detalhes" → "acessar este site"
4. Toque em **Entrar na chamada** nos dois aparelhos e libere o microfone.
5. Pronto — podem conversar. Para encerrar, toque em **Desligar**
   (e `Ctrl+C` no servidor quando quiser parar tudo).

## Interface (React)

A UI fica em `client/` (Vite + React + TypeScript). O `server.js` serve o build
de `client/dist` automaticamente; se não houver build, ele cai numa página simples.

**Para gerar/atualizar a interface:**

```bash
cd client
npm install        # só na primeira vez
npm run build      # gera client/dist (é o que o server.js serve)
```

Depois é só rodar o `server.js` de sempre — ele já serve a interface nova.

**Para desenvolver com recarga automática (hot reload):**

```bash
# terminal 1 — backend de sinalização em modo http
node server.js --http

# terminal 2 — Vite (faz proxy de /api para o backend)
cd client && npm run dev
```

Abra o endereço que o Vite mostrar (ex.: `http://localhost:5173`). Em
`localhost` o microfone funciona mesmo em http; para testar no celular use o
build + HTTPS do `server.js`.

Recursos da interface: tema claro/escuro, identidade (seu nome / nome do outro),
estados claros de chamada, duração, mudo com medidor de nível, seletor de
microfone, indicador de qualidade da conexão e reconexão automática.

## Pelo Claude (MCP)

O projeto inclui um **MCP server** (`mcp-server.js`) já registrado no Claude Code
(escopo de usuário), então em **qualquer sessão** do Claude você pode pedir, em
linguagem natural, coisas como:

- *"inicie a ligação local"* → liga o servidor e devolve os endereços
- *"qual o endereço da ligação?"* → mostra os links sem ligar nada
- *"a ligação está no ar?"* → status (rodando? em que porta? qual PID?)
- *"encerre a ligação"* → desliga o servidor e libera a porta

Ferramentas expostas: `start_call`, `stop_call`, `call_status`, `get_urls`.
O servidor iniciado pelo MCP **continua rodando** mesmo depois que a sessão do
Claude terminar (até você mandar encerrar ou reiniciar o PC).

Detalhes técnicos:
- Sem dependências de npm — Node puro, JSON-RPC 2.0 sobre stdio.
- Registrado com:
  ```
  claude mcp add ligacao-local --scope user -- node "C:\Users\juanp\Documents\ligacao-local\mcp-server.js"
  ```
  Para remover: `claude mcp remove ligacao-local --scope user`.
- **Se você mover a pasta de novo**, refaça o registro com o novo caminho
  (o caminho fica fixo na configuração).
- Cria um arquivo `.mcp-state.json` na pasta para lembrar qual processo iniciou.

## Firewall (se o celular não abrir a página)

O Windows 11 costuma marcar redes Wi-Fi novas como **"Pública"** e, nesse perfil,
bloqueia conexões de entrada — então o servidor roda mas o celular não consegue
abrir a página. Duas saídas:

- **Mais fácil:** marque seu Wi-Fi como **Rede particular**.
  Configurações → Rede e Internet → Wi-Fi → (nome da rede) → "Tipo de perfil de
  rede" → **Particular**. Depois tente abrir de novo no celular.
- **Ou:** libere a porta no Firewall (PowerShell **como Administrador**):
  ```powershell
  New-NetFirewallRule -DisplayName "Ligacao Local" -Direction Inbound `
    -Protocol TCP -LocalPort 8443 -Action Allow -Profile Any
  ```
  Para remover depois: `Remove-NetFirewallRule -DisplayName "Ligacao Local"`.

Na primeira vez que o Node abre a porta, o Windows também pode mostrar um aviso
do Firewall — se aparecer, marque **Redes particulares** e clique em **Permitir**.

## Detalhes

- Funciona em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).
- Máximo de 2 pessoas na sala.
- O certificado (`cert.pfx`) é criado automaticamente na primeira execução
  e vale por 5 anos. Pode apagar o arquivo para gerar outro.
- Nada sai da sua rede local: sem STUN, sem TURN, sem servidores externos.
- Se o áudio não conectar, verifique se os dois aparelhos estão no mesmo
  Wi-Fi (redes de "convidados" às vezes isolam os aparelhos entre si).

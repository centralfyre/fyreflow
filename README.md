# FyreFlow

Plataforma pequena para acompanhar as atividades da equipe usando a API do Trello:

- **Entregues no dia**: atividades movidas para uma lista de "concluído" em uma data específica, agrupadas por pessoa.
- **Todas as atividades**: tudo o que está atribuído a cada pessoa no(s) board(s), independente do status.
- **Atrasadas**: atividades com prazo vencido (e ainda não concluídas), agrupadas por pessoa.

## Como funciona

Um servidor Node/Express consulta a API REST do Trello (boards, listas, cartões e histórico de movimentação) usando sua API key/token, normaliza os dados e expõe endpoints simples que o frontend estático consome.

Não há build step — é HTML/CSS/JS puro servido pelo próprio Express.

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Preencha o `.env`:
   - `TRELLO_KEY` e `TRELLO_TOKEN`: gere em https://trello.com/app-key (a key fica na página; o token é gerado a partir do link "Token" na mesma página, autorizando acesso de leitura).
   - `TRELLO_WORKSPACE_IDS`: nome (ou ID) da(s) Workspace(s) do Trello a monitorar. A plataforma busca automaticamente **todos os boards abertos** dessa Workspace — inclusive boards de clientes criados depois. O nome aparece na URL: `trello.com/w/<NOME>/...`. Separe múltiplas Workspaces por vírgula.
   - `TRELLO_BOARD_IDS` (opcional): IDs de boards específicos a incluir, além dos que já vêm da Workspace (útil se algum board estiver fora da Workspace principal). O ID aparece na URL do board: `trello.com/b/<ID>/nome-do-board`.
   - `DONE_LIST_KEYWORDS` (opcional): personalize quais nomes de lista contam como "entregue". Por padrão: `concluído, concluido, done, feito, entregue, finalizado, pronto` — qualquer lista cujo nome contenha uma dessas palavras é tratada como lista de conclusão.

   É preciso preencher `TRELLO_WORKSPACE_IDS` e/ou `TRELLO_BOARD_IDS` — ao menos um dos dois.

4. Rode o servidor:

   ```bash
   npm start
   ```

5. Acesse http://localhost:3000

## Como a "data de entrega" é calculada

O Trello não expõe diretamente "quando o cartão foi movido para tal lista" no endpoint de cartões. Para cada cartão que está hoje em uma lista de "concluído", a plataforma busca o histórico de ações do cartão (`updateCard:idList` / `createCard`) e usa a data da última vez que ele entrou nessa lista. Se essa consulta falhar por qualquer motivo, a plataforma usa `dateLastActivity` do cartão como aproximação.

## Endpoints da API

- `GET /api/members` — lista de membros do(s) board(s).
- `GET /api/activities/delivered?date=YYYY-MM-DD` — atividades entregues no dia informado (padrão: hoje), por pessoa.
- `GET /api/activities/all` — todas as atividades abertas, por pessoa.
- `GET /api/activities/overdue` — atividades com prazo vencido e não concluídas, por pessoa.

## Notas

- Os dados de board/listas/cartões ficam em cache por 1 minuto e o histórico de movimentação de cada cartão por 10 minutos, para evitar exceder os limites de taxa da API do Trello.
- Cartões arquivados/fechados não são considerados.

## Publicar online (Render)

O repositório já inclui um `render.yaml`, então o deploy é praticamente automático:

1. Crie uma conta gratuita em https://render.com e conecte sua conta do GitHub.
2. No painel do Render, clique em **New +** → **Blueprint**.
3. Selecione o repositório `centralfyre/fyreflow`.
4. O Render vai detectar o `render.yaml` e propor o serviço `fyreflow`. Confirme.
5. Antes (ou logo depois) do primeiro deploy, preencha as variáveis de ambiente pedidas no painel do serviço, em **Environment**:
   - `TRELLO_KEY`
   - `TRELLO_TOKEN`
   - `TRELLO_WORKSPACE_IDS` (nome da Workspace, para trazer todos os boards de clientes automaticamente)
   - `TRELLO_BOARD_IDS` (opcional, boards extras fora da Workspace)
   - `DONE_LIST_KEYWORDS` (opcional)
6. Clique em **Deploy**. Em poucos minutos o Render te dá uma URL pública tipo `https://fyreflow.onrender.com` — é essa URL que você acessa no navegador (inclusive no celular).

No plano gratuito, o serviço "dorme" depois de um tempo sem acesso e demora ~30s para acordar na primeira requisição seguinte — normal, não é erro.

Se preferir Railway ou Fly.io em vez do Render, o processo é parecido: conectar o repositório, definir `npm start` como comando de start e configurar as mesmas variáveis de ambiente.

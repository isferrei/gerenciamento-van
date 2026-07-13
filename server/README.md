# Gerenciamento Van API

API Node/Express do projeto Gerenciamento Van para salvar lancamentos e configuracoes no MongoDB.

## Configurar MongoDB

1. No MongoDB Atlas, use o nome de projeto `Gerenciamento Van`.
2. Crie um cluster.
3. Crie um usuario e senha de banco.
4. Libere seu IP em Network Access.
5. Copie a connection string.
6. Crie um arquivo `server/.env` baseado em `server/.env.example`.

Exemplo:

```txt
MONGODB_URI=mongodb+srv://USUARIO:SENHA@SEU_CLUSTER.mongodb.net/gerenciamento-van?retryWrites=true&w=majority
```

## Rodar localmente

```bash
cd server
npm run dev
```

Por padrao, a API roda em:

```txt
http://localhost:3001
```

Para usar outra porta:

```bash
PORT=3002 npm run dev
```

## Endpoints

```txt
GET    /health

GET    /entries
GET    /entries/:id
POST   /entries
POST   /entries/import
PUT    /entries/:id
DELETE /entries/:id

GET    /settings
PUT    /settings
```

## Exemplos

Listar lancamentos:

```bash
curl http://localhost:3001/entries
```

Criar ou substituir um lancamento:

```bash
curl -X POST http://localhost:3001/entries \
  -H "Content-Type: application/json" \
  -d '{"id":"teste-1","date":"2026-07-11","km":1000}'
```

Importar varios lancamentos:

```bash
curl -X POST http://localhost:3001/entries/import \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"id":"teste-1","date":"2026-07-11","km":1000}]}'
```

Buscar configuracoes:

```bash
curl http://localhost:3001/settings
```

Atualizar configuracoes:

```bash
curl -X PUT http://localhost:3001/settings \
  -H "Content-Type: application/json" \
  -d '{"valorViagemEdson":60}'
```

## Importar dados antigos do JSON local

Se voce ja tinha dados em `server/data/db.json`, configure `MONGODB_URI` e rode:

```bash
cd server
npm run import:json
```

Se os dados ainda estao no `localStorage` do navegador, use o botao `Migrar dados locais para API` na tela de Configuracoes com a API rodando.

## Persistencia

Os dados ficam no MongoDB, nas colecoes:

```txt
entries
settings
```

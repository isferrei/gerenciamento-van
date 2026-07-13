# Publicacao

Este projeto tem duas partes:

```txt
Frontend React/Vite -> Netlify
API Node/Express    -> Render
Banco               -> MongoDB Atlas
```

## 1. Publicar a API

No Render, crie um novo Web Service apontando para este repositorio.

Configuracao:

```txt
Name: gerenciamento-van-api
Root Directory: server
Build Command: npm install
Start Command: npm start
```

Variaveis de ambiente da API:

```txt
MONGODB_URI=sua connection string do MongoDB Atlas
CORS_ORIGIN=https://seu-site.netlify.app
```

Enquanto voce ainda nao tiver a URL da Netlify, pode deixar `CORS_ORIGIN` vazio no primeiro deploy da API.

Depois do deploy, teste:

```txt
https://sua-api.onrender.com/health
```

## 2. Publicar o frontend

No Netlify, crie um novo site apontando para este repositorio.

Configuracao:

```txt
Build Command: npm run build
Publish Directory: dist
```

Variaveis de ambiente do frontend:

```txt
VITE_API_URL=https://sua-api.onrender.com
```

Se voce usa a funcao de OCR/extracao por imagem, tambem configure:

```txt
OPENAI_API_KEY=sua chave
```

## 3. Ajustar CORS depois

Quando a Netlify gerar a URL final do site, volte na API e configure:

```txt
CORS_ORIGIN=https://seu-site.netlify.app
```

Depois redeploy a API.

## 4. Seguranca

Nao publique arquivos `.env`.

Como a senha antiga do MongoDB ja foi compartilhada durante a configuracao, troque a senha do usuario no MongoDB Atlas e atualize `MONGODB_URI` no Render e em `server/.env`.

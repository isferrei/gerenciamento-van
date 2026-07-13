# Gerenciamento Van

PWA para controle diário de van: lançamentos com **vales**, **viagens por motorista (Edson / Bispo)**, salários calculados, resumo mensal e **pagamento semanal**.

## MVP e armazenamento

- **Dados:** lançamentos e configurações ficam apenas no **`localStorage`** deste navegador (sem servidor).
- **Imagens:** pré-visualização só na memória; **não** são gravadas no `localStorage`. No lançamento diário, se usar **«Ler imagens e preencher campos»**, as fotos são enviadas à **Netlify Function** (`extract-entry`) apenas para preencher o formulário; não ficam armazenadas após o uso.
- **Backup:** use **Exportar CSV** com frequência; limpar dados ou trocar de aparelho apaga tudo localmente.

## Requisitos

- Node.js 20+ (recomendado LTS)

## Rodar localmente

```bash
cd gerenciamento-van
npm install
npm run dev
```

Abra o endereço do terminal (geralmente `http://localhost:5173`).

Para testar a **leitura automática**, a função Netlify precisa estar na porta **8888**. Em modo desenvolvimento o app já chama `http://localhost:8888/.netlify/functions/extract-entry`.

**Opção A — um comando** (Vite + Netlify juntos):

```bash
npm run dev:with-functions
```

**Opção B — dois terminais:**

```bash
# terminal 1
npm run dev

# terminal 2 (pasta do projeto)
npx netlify dev
```

Opcional: em `.env.development.local`, **`VITE_EXTRACT_ENTRY_URL`** sobrescreve essa URL (ex.: função já deployada ou porta diferente).

**Local com `netlify dev`:** crie **`.env` na raiz do projeto** (não em `src/`) com `OPENAI_API_KEY=sk-...` — a função também carrega esse arquivo automaticamente. Não use prefixo `VITE_` (a chave não pode ir para o bundle do front).

Em **build de produção**, o app usa `/.netlify/functions/extract-entry` no mesmo domínio (Netlify); não precisa de env para URL da função.

Build de produção:

```bash
npm run build
npm run preview   # opcional: testar a pasta dist/
```

Saída em `dist/`.

## Publicar no Netlify

1. Conecte o repositório em [Netlify](https://www.netlify.com/) ou use a CLI.
2. **Build command:** `npm run build`
3. **Publish directory:** `dist`
4. O `netlify.toml` já define redirect SPA `/*` → `/index.html` (as funções em `/.netlify/functions/*` continuam a ser atendidas pela Netlify antes do fallback da SPA).

### `OPENAI_API_KEY` (leitura automática no site publicado)

A função `extract-entry` lê `process.env.OPENAI_API_KEY`. Sem ela, o app mostra o aviso amarelo e não preenche os campos.

1. Crie uma chave em [API keys · OpenAI](https://platform.openai.com/api-keys) (começa com `sk-`).
2. No Netlify: **[Sites](https://app.netlify.com)** → escolha o site → **Site configuration** → **Environment variables** → **Add a variable** (ou **Add variable with duplicate scopes**).
3. **Key:** `OPENAI_API_KEY` exatamente assim (maiúsculas). **Value:** cole a chave `sk-...`. Marque como **secret**. Escopos: habilite pelo menos **Production** (e **Deploy Previews** / **Branch deploys** se quiser OCR em previews).
4. Salve. As **invocações seguintes** da função já recebem a variável. Se não notar efeito, em **Deploys** use **Trigger deploy** → **Deploy project** (ou **Clear cache and deploy site**).

Documentação Netlify: [variáveis de ambiente — introdução](https://docs.netlify.com/environment-variables/get-started/).

CLI (opcional):

```bash
npm i -g netlify-cli
cd gerenciamento-van
npm run build
netlify deploy --prod --dir=dist
```

## Interface (resumo)

- **Dashboard (`/`):** KPIs do mês, lançamento do dia, pagamento semanal, gráfico (KM + lucro), últimos lançamentos, atalhos CSV.
- **Lançamento:** data, dia da semana, KM, quantidade de vales, valor dos vales (automático), combustível, outras despesas, viagens Edson/Bispo (com pré-preenchimento), salários e lucro em tempo real; fotos só para conferência.
- **Pagamento semanal:** filtro por mês; totais por semana (Edson / Bispo / total).
- **Configurações:** valores de vale e por viagem, padrões de viagens e domingo, troca de óleo.

## Stack

- React 19 + Vite + TypeScript  
- Tailwind CSS v4  
- React Router  
- Recharts (gráfico)  
- `localStorage`

## Licença

Uso pessoal / interno do operador.

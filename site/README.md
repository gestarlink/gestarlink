# GestarLink — Site, chat e CRM

Código da nova GestarLink em `site/` dentro do repositório de perfil `gestarlink/gestarlink`. O README original do perfil fica na raiz, preservado.

**Status:** versionamento no GitHub não significa publicação: a versão pública permanece inalterada até a execução manual do workflow e validação na Cloudflare.

## Arquitetura

- `public/`: site institucional PT/EN/ES, assistente de vendas flutuante e painel administrativo `/admin.html`.
- `public/_worker.js`: API do chat e CRM para Cloudflare Pages Advanced Mode.
- `db/schema.sql`: tabelas de visitantes, conversas, leads e painel D1.
- `test/`: testes de unidade e estáticos (`npm test`).
- `functions/api/`: alternativa de rota Pages Functions (não carregada quando `_worker.js` é usado).
- `../.github/workflows/deploy-cloudflare-pages.yml`: publicação **manual** no projeto Pages existente `gestarlink`; escolha `preview` antes de `production`.

## Publicação segura (depois de cadastrar os segredos)

1. Na Cloudflare crie banco D1 `gestarlink-crm`. O ID é usado como secret do GitHub.
2. Em GitHub, configure Actions Secrets no repositório: `CLOUDFLARE_API_TOKEN` (permissões mínimas Pages + D1), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`. **Não coloque segredos em commits.**
3. No Pages do projeto `gestarlink` configure `ADMIN_PASSWORD` (senha forte, exclusiva, pelo menos 12 caracteres) e `SESSION_SECRET` (string aleatória de >= 32 bytes) como segredos. A aplicação bloqueia API de dados quando DB ausente.
4. O workflow obtém `logo.png` original do próprio site `https://gestarlink.com/logo.png` durante o deploy. Isso preserva a marca fiel sem reinterpretá-la; se o download falhar, não haverá deploy.
5. No GitHub Actions escolha workflow **GestarLink • Cloudflare Pages**, `Run workflow`, ambiente `preview`. Confirme rota `/api/health`, `/admin.html`, chat e D1. Não promova para produção antes dos testes finais.
6. Depois de confirmado, execute novamente escolhendo `production`. Cloudflare permite reverter via deployments anteriores.

## Recursos e limites

- Frontend e CRM são implementação inicial que dependem de testes reais e configuração em produção. IA generativa requer binding `AI` na Cloudflare; sem ele o bot responde via regras guiadas.
- O banco não envia notificações ao dono automaticamente; contatos ficam no painel.
- Analytics de visitantes são baseados em consentimento. Não é possível identificar uma pessoa sem que ela informe dados.
- Os arquivos usam referências genéricas de portfólio; confirme informações e preços antes de publicar.

## Testar localmente

```sh
cd site
npm install --ignore-scripts
npm test
```

# GestarLink — site, atendente e CRM

Código versionado em `site/` dentro do repositório `gestarlink/gestarlink`. A raiz e o README do perfil permanecem preservados.

## Status
O código está no GitHub e os testes automáticos são executados a cada alteração. A publicação em `gestarlink.com` requer as credenciais da Cloudflare salvas como segredos no GitHub e uma execução manual do workflow em Preview.

## O que está implementado
- Site comercial responsivo PT/EN/ES e apresentação de serviços.
- Atendente flutuante com chat guiado e IA opcional.
- CRM privado em `/admin.html`, leads, visitas consentidas, conversas, histórico e funil.
- D1 com bancos independentes para preview e produção.
- Workflow GitHub Actions em `../.github/workflows/deploy-cloudflare-pages.yml`.

## Preparação da primeira publicação — uma única vez

1. Crie um token Cloudflare com permissões **Account → Cloudflare Pages → Edit** e **Account → D1 → Edit**, limitado à sua conta. Não cole o token no chat ou nos arquivos.
2. No GitHub, repositório `gestarlink/gestarlink` → **Settings → Secrets and variables → Actions → New repository secret**, cadastre:
   - `CLOUDFLARE_API_TOKEN`: token acima.
   - `CLOUDFLARE_ACCOUNT_ID`: identificador da sua conta Cloudflare (não é senha).
   - `GESTARLINK_ADMIN_PASSWORD`: senha exclusiva e forte, com no mínimo 12 caracteres, que você usará em `/admin.html`.
3. Abra **Actions → GestarLink • Cloudflare Pages → Run workflow**, escolha **preview**. O workflow valida o código, localiza ou cria o D1 separado de preview, aplica o esquema SQL, configura a senha e uma chave aleatória de sessão na Cloudflare e publica na URL de prévia.
4. Valide `https://preview.gestarlink.pages.dev/`, o chat e o painel. O site oficial não será substituído por um deploy de preview.
5. Somente depois de validar o funcionamento completo, execute o workflow escolhendo **production**. Ele utiliza um banco D1 diferente.

Nunca coloque valores secretos no repositório. O workflow não tem gatilho automático para deploy: atualizações de código executam apenas os testes. A implantação é manual para proteger a versão atual.

## Limitações
- O atendimento via IA generativa só funciona quando um binding `AI` compatível é configurado; sem ele, utiliza respostas guiadas.
- O CRM registra visitantes mediante consentimento de analytics ou quando eles iniciam contato. A identificação real depende dos dados fornecidos voluntariamente.
- Ainda não há alertas externos automáticos por e-mail ou WhatsApp.
- A execução de produção exige testes e revisão dos dados comerciais e política de privacidade.

## Testar
```sh
cd site
npm install --ignore-scripts
npm test
```

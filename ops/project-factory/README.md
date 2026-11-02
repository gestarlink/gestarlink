# Central de Projetos GestarLink — GitHub + Cloudflare

**Estado:** código de automação preparado. A execução real depende de configurar os segredos de GitHub Actions abaixo e rodar um teste. Não há acesso independente e permanente do ChatGPT à Cloudflare; as credenciais ficam restritas ao GitHub Actions.

## Objetivo

Uma solicitação feita pelo usuário no ChatGPT cria uma issue no GitHub; um workflow validado cria o repositório novo na conta gestarlink e um projeto Cloudflare Pages (ou faz o deploy de um projeto existente). Nenhuma alteração de DNS ou domínio personalizado é automática.

## Instalação única (NÃO coloque tokens nesta conversa)

1. Abra https://github.com/settings/personal-access-tokens/new e crie um fine-grained personal access token na conta gestarlink. Ele precisa permitir Repository creation: write e Contents: read/write para os repositórios que serão administrados. Para gerenciar projetos futuros arbitrários, configure acesso a todos os repositórios com o menor conjunto de permissões possível. Escolha prazo de validade e renove quando necessário.
2. Abra https://github.com/gestarlink/gestarlink/settings/secrets/actions e adicione o segredo GH_FACTORY_TOKEN com o valor desse token. NÃO escreva o token em uma issue, no chat ou no código.
3. No Cloudflare, em https://dash.cloudflare.com/profile/api-tokens, crie um API token limitado à conta correta, com a permissão Cloudflare Pages: Edit. NÃO use a Global API Key. Se CLOUDFLARE_API_TOKEN já estiver configurado no GitHub com essa permissão, pode mantê-lo; caso contrário, atualize o valor na tela de secrets.
4. No mesmo repositório, configure CLOUDFLARE_ACCOUNT_ID com o Account ID da Cloudflare, não com a ID da zona DNS.
5. Verifique se GitHub Actions está ativo. A automação fica no arquivo .github/workflows/gestarlink-project-factory.yml da branch main.
6. Teste primeiro com um repositório privado sem dados reais. O teste não deve substituir sites existentes.

**Segurança:** apenas issues abertas pelo usuário GitHub de ID 84834803 e com título iniciado por [factory] podem acionar esse workflow. O corpo precisa ser um JSON simples e validado. A etapa de compilação não recebe tokens de GitHub/Cloudflare. Proteja sua conta com autenticação multifator e revise mudanças futuras no workflow.

## Criar repositório e projeto Cloudflare

Crie uma issue em gestarlink/gestarlink com título:

[factory] criar projeto academia-online

Corpo (apenas o JSON, sem formatação Markdown):

{"operation":"create","name":"academia-online","private":true,"description":"Gerenciamento de academias"}

A automação cria um repositório GitHub novo com uma página inicial em public/index.html e registra um projeto de mesmo nome no Cloudflare Pages. NÃO publica automaticamente nesta etapa.

## Fazer deploy

Crie uma issue com título:

[factory] publicar academia-online

Corpo:

{"operation":"deploy","name":"academia-online"}

Quando package.json está presente, o workflow executa npm run build e procura as pastas dist, public, build e out, nesta ordem. Também é possível escolher uma pasta relativa:

{"operation":"deploy","name":"academia-online","output_dir":"dist"}

O fluxo publica com Wrangler no Pages, registra resultado na issue e NÃO altera o domínio personalizado. Toda publicação depende da validação do código e do funcionamento das APIs.

## Limitações e próximos incrementos

- A conexão GitHub do ChatGPT não oferece hoje uma ação nativa de criação de repositórios. O workflow por issue permite realizar essa etapa sem nova sessão no navegador, após as credenciais serem cadastradas.
- A automação ainda não foi testada com credenciais reais do usuário e nem com deploy real.
- Não faz migrações de domínio/DNS, não cria banco de dados e não gera códigos completos por si só.
- Para cada projeto: criar repositório, gravar o código pelo GitHub conectado e depois solicitar deploy. Sua instalação GitHub atualmente seleciona todos os repositórios.
- Para mudar domínio, alterar DNS, transferir propriedade ou publicar em produção, é necessário um pedido explícito e acesso adequado à zona do domínio.
- Renovações ou alterações de permissões dos tokens podem exigir nova intervenção ocasional.

## Acompanhamento

Central: https://github.com/gestarlink/gestarlink/issues
Execuções: https://github.com/gestarlink/gestarlink/actions/workflows/gestarlink-project-factory.yml
Credenciais: https://github.com/gestarlink/gestarlink/settings/secrets/actions

Nenhuma senha ou token foi adicionada ao repositório.

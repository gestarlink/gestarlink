# Gestar Mídia — MVP de planejamento de conteúdo

**Situação:** protótipo interativo, ainda **sem publicação real no Instagram**. Desenvolvido para validar o fluxo com WMT Acre, WMT Brasil e Catablum.

## Abrir o protótipo
Abra `gestar-midia-mvp/index.html` em um navegador moderno. Para testar em um servidor local:

```bash
cd gestar-midia-mvp
python3 -m http.server 8000
```

Depois visite `http://localhost:8000`. Pode ser hospedado como site estático independente no Cloudflare Pages. **Não contém credenciais e não deve ser usado como backend de produção.**

## Funcionalidades disponíveis
- Alternar WMT Acre, WMT Brasil e Catablum, com separação das mídias, regras e publicações no navegador.
- Adicionar fotos e vídeos autorizados; o binário é salvo via IndexedDB do navegador, até 75 MB/arquivo.
- Escrever instruções, preparar **legenda demonstrativa** por regras locais, revisar e editar.
- Agendar, aprovar, editar e excluir publicações **locais**.
- Visualizar calendário dos próximos sete dias no fuso `America/Rio_Branco`.
- Planejar os próximos dias conforme frequência e horário configurados.
- Piloto Automático é **apenas uma configuração de planejamento local**: não há postagem automática nem rotina em segundo plano.
- Estatísticas do próprio planejamento; nenhuma métrica do Instagram é inventada.

## Limitações e cuidados
- A mídia e os agendamentos **não são sincronizados entre dispositivos** e podem ser perdidos ao limpar os dados do navegador.
- A seleção das melhores fotos, a criação automática de Reels e legendas por **IA generativa ainda não foram implementadas**.
- A conta do Instagram **não está conectada**; o sistema não publica, não agenda na Meta e não coleta credenciais.
- Faça backup dos arquivos originais. Para imagens de alunos, especialmente menores, mantenha autorizações de uso de imagem válidas.
- Não use este MVP para operação multiusuário, comercial ou armazenamento de conteúdo sensível.

## Próxima etapa para a versão online real
1. Criar um repositório/projeto dedicado da Gestar Mídia, evitando misturar a operação com o site institucional da GestarLink.
2. Implantar identidade/autenticação, organizações, perfis e permissões (Supabase Auth + Postgres/RLS).
3. Armazenar mídias com acesso controlado no Supabase Storage e validar direitos de uso.
4. Incorporar geração de legendas por IA no servidor, com revisão e limites.
5. Integrar Meta Instagram API oficial: login profissional, permissões, renovação segura de tokens, criação de contêineres e publicação.
6. Executar agendamentos em servidor (Cloudflare Cron/Queues) com controle de duplicidade, tentativas, logs, alertas e consentimento.
7. Testar em conta profissional autorizada da WMT Acre, antes de disponibilizar a terceiros.

**Atenção:** a branch `feature/gestar-midia-mvp-v01` foi criada para revisão; o repositório existente `gestarlink/gestarlink` tem deploy próprio e o projeto Gestar Mídia não deve ser incorporado ao site público por engano.

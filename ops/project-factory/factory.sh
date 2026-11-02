#!/usr/bin/env bash
set -euo pipefail
ROOT="$GITHUB_WORKSPACE"
REQUEST="$ROOT/.factory-request.json"
PHASE="$1"
NAME="$(jq -er '.name' "$REQUEST")"
OWNER="gestarlink"
REPO="$OWNER/$NAME"
PROJECT_DIR="$ROOT/.factory-target"

cf_ensure() {
  local base="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects"
  local status response
  status="$(curl -sS -o "$RUNNER_TEMP/cf-project.json" -w '%{http_code}' \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "$base/$NAME")"
  if [[ "$status" == "200" ]]; then
    jq -e '.success == true' "$RUNNER_TEMP/cf-project.json" >/dev/null
  elif [[ "$status" == "404" ]]; then
    response="$(jq -nc --arg name "$NAME" '{name:$name,production_branch:"main"}')"
    curl -fsS -X POST "$base" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "$response" > "$RUNNER_TEMP/cf-project.json"
    jq -e '.success == true' "$RUNNER_TEMP/cf-project.json" >/dev/null
    echo "Cloudflare Pages project criado: $NAME"
  else
    echo "Cloudflare respondeu HTTP $status. Verifique a conta e as permissões Pages Edit."
    exit 1
  fi
}

case "$PHASE" in
  create)
    if gh api "repos/$REPO" >/dev/null 2>&1; then
      echo "O repositório $REPO já existe. Nada será sobrescrito."
      exit 1
    fi
    jq -c '{name,description,private,auto_init:true,has_issues:true}' "$REQUEST" \
      > "$RUNNER_TEMP/newrepo.json"
    gh api --method POST "/user/repos" --input "$RUNNER_TEMP/newrepo.json" \
      > "$RUNNER_TEMP/newrepo-result.json"
    jq -e --arg name "$REPO" '.full_name == $name' "$RUNNER_TEMP/newrepo-result.json" >/dev/null
    cat > "$RUNNER_TEMP/index.html" <<'HTML'
<!doctype html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Projeto em desenvolvimento</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111529;color:#fff;font:16px system-ui}main{max-width:580px;margin:24px;padding:30px;border-radius:20px;background:#1b2140}h1{font-size:30px}p{line-height:1.6;color:#d4d9ee}</style></head>
<body><main><h1>Projeto em desenvolvimento</h1><p>Este repositório foi preparado pela Central de Projetos GestarLink. O site estará disponível depois do primeiro deploy.</p></main></body></html>
HTML
    jq -nc --arg msg "chore: initialize GestarLink project" \
      --arg c "$(base64 -w0 < "$RUNNER_TEMP/index.html")" \
      '{message:$msg,content:$c,branch:"main"}' > "$RUNNER_TEMP/content.json"
    gh api --method PUT "repos/$REPO/contents/public/index.html" \
      --input "$RUNNER_TEMP/content.json" >/dev/null
    cf_ensure
    printf "✅ Repositório criado: https://github.com/%s\n✅ Projeto Cloudflare Pages registrado: %s\nℹ️ Ainda não publicado. Envie uma solicitação de deploy quando desejar.\n" \
      "$REPO" "$NAME" > "$ROOT/.factory-result.md"
    ;;
  clone)
    gh auth setup-git >/dev/null
    gh repo clone "$REPO" "$PROJECT_DIR" -- --depth=1
    ;;
  build)
    cd "$PROJECT_DIR"
    if [[ -f package.json ]]; then
      if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
      npm run build --if-present
    fi
    OUTPUT_DIR="$(jq -r '.output_dir // ""' "$REQUEST")"
    if [[ -z "$OUTPUT_DIR" ]]; then
      for dir in dist public build out; do
        if [[ -d "$dir" ]]; then OUTPUT_DIR="$dir"; break; fi
      done
    fi
    if [[ -z "$OUTPUT_DIR" || ! -d "$OUTPUT_DIR" ]]; then
      echo "Não encontrei a pasta de publicação (dist, public, build, out). Informe output_dir."
      exit 1
    fi
    printf '%s' "$OUTPUT_DIR" > "$ROOT/.factory-output-dir"
    echo "Pasta de publicação: $OUTPUT_DIR"
    ;;
  deploy)
    cd "$PROJECT_DIR"
    OUTPUT_DIR="$(cat "$ROOT/.factory-output-dir")"
    cf_ensure
    npx --yes wrangler@4 pages deploy "$OUTPUT_DIR" \
      --project-name "$NAME" --branch main
    printf "✅ Deploy enviado para Cloudflare Pages.\n✅ Repositório: https://github.com/%s\n✅ Projeto Cloudflare: %s\nℹ️ Consulte a URL exata no registro da implantação; domínio personalizado não é alterado automaticamente.\n" \
      "$REPO" "$NAME" > "$ROOT/.factory-result.md"
    ;;
  *)
    echo "Fase desconhecida: $PHASE" >&2
    exit 1
    ;;
esac

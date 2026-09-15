#!/usr/bin/env bash
# Vigia da conexao do WhatsApp: se a instancia cair, manda reconectar.
# A sessao fica no Postgres, entao reconectar NAO exige ler o QR de novo.
# Instalado no cron a cada 5 minutos.
set -uo pipefail

ENV_FILE=/opt/alfaaltogrup/deploy/.env
API_BASE=${API_BASE:-https://go.evo.alfastage.com.br}
LOG=/var/log/evolution-watchdog.log

[ -f "$ENV_FILE" ] || { echo "$(date -Is) sem $ENV_FILE" >> "$LOG"; exit 1; }
GLOBAL_KEY=$(grep -E '^EVOLUTION_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$GLOBAL_KEY" ] || { echo "$(date -Is) sem EVOLUTION_API_KEY" >> "$LOG"; exit 1; }

log() { echo "$(date -Is) $*" >> "$LOG"; }

instances=$(curl -sf --max-time 25 -H "apikey: $GLOBAL_KEY" "$API_BASE/instance/all" \
  | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    for i in (d.get("data") if isinstance(d,dict) else d) or []:
        n=i.get("name") or ""
        t=i.get("token") or ""
        if n and t: print(n+"\t"+t)
except Exception:
    pass')

[ -n "$instances" ] || { log "nao consegui listar instancias"; exit 1; }

while IFS=$'\t' read -r name token; do
  [ -n "$token" ] || continue
  status=$(curl -sf --max-time 25 -H "apikey: $token" "$API_BASE/instance/status" || echo '')
  connected=$(printf '%s' "$status" | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("data",{}).get("Connected"))
except Exception:
    print("erro")')

  if [ "$connected" = "True" ]; then
    continue
  fi

  log "[$name] fora do ar (Connected=$connected) - reconectando"
  curl -sf --max-time 30 -X POST -H "apikey: $token" -H 'Content-Type: application/json' \
    -d '{}' "$API_BASE/instance/reconnect" >/dev/null 2>&1

  sleep 15
  recheck=$(curl -sf --max-time 25 -H "apikey: $token" "$API_BASE/instance/status" \
    | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("data",{}).get("Connected"))
except Exception:
    print("erro")')
  log "[$name] apos reconexao: Connected=$recheck"
done <<< "$instances"

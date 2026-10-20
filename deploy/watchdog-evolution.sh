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

# Limpa conexoes ociosas (> 10min) vazadas pela Evolution GO no Postgres,
# preservando sempre as 8 conexoes mais recentes do pool ativo.
reaped=$(sudo docker exec deploy-postgres-1 psql -U postgres -tAq -c "
  SELECT count(pg_terminate_backend(pid))
  FROM pg_stat_activity
  WHERE datname IN ('evogo_auth', 'evogo_users')
    AND state = 'idle'
    AND state_change < now() - interval '10 minutes'
    AND pid <> pg_backend_pid()
    AND pid NOT IN (
      SELECT pid FROM pg_stat_activity
      WHERE datname IN ('evogo_auth', 'evogo_users')
      ORDER BY state_change DESC
      LIMIT 8
    );
" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ -n "$reaped" ] && [ "$reaped" != "0" ]; then
  log "[postgres] $reaped conexao(oes) ociosa(s) vazada(s) encerrada(s)"
fi

instances=$(curl -sf --max-time 25 -H "apikey: $GLOBAL_KEY" "$API_BASE/instance/all" \
  | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    for i in (d.get("data") if isinstance(d,dict) else d) or []:
        n=i.get("name") or ""
        t=i.get("token") or ""
        j=i.get("jid") or ""
        if n and t: print(n+"\t"+t+"\t"+j)
except Exception:
    pass')

[ -n "$instances" ] || { log "nao consegui listar instancias"; exit 1; }

while IFS=$'\t' read -r name token jid; do
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

  # So tenta reconectar automaticamente se a instancia possuir JID pareado no banco whatsmeow_device.
  # Se foi desconectada/deslogada manualmente (sem sessao), nao dispara loop de QR Code nem vaza pool SQL.
  if [ -z "$jid" ]; then
    continue
  fi
  has_device=$(sudo docker exec deploy-postgres-1 psql -U postgres -d evogo_auth -tAq -c \
    "SELECT count(*) FROM whatsmeow_device WHERE jid = '$jid';" 2>/dev/null | tr -d '[:space:]' || echo "0")
  if [ "$has_device" = "0" ]; then
    log "[$name] desconectada e sem sessao ativa em whatsmeow_device (aguardando QR Code manual)"
    continue
  fi

  log "[$name] fora do ar (Connected=$connected) - reconectando sessao existente ($jid)"
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

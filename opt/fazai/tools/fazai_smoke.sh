#!/usr/bin/env bash
set -euo pipefail
API=${API:-http://127.0.0.1:3120}
echo "== Smoke tests FazAI =="
curl -fsS "$API/health" >/dev/null && echo "health: OK"
curl -fsS "$API/services" >/dev/null && echo "services: OK"
curl -fsS "$API/metrics" >/dev/null && echo "metrics: OK (may be sparse)"
curl -fsS -X POST "$API/nl/route" -H 'Content-Type: application/json' -d '{"text":"listar regras do firewall opnsense"}' >/dev/null && echo "nl.route: OK"
curl -fsS -X POST "$API/sec/policies" -H 'Content-Type: application/json' -d '{"interval_sec":30, "rules":[]}' >/dev/null && echo "sec.policies: OK"
curl -fsS -X POST "$API/security/modsecurity/setup" -H 'Content-Type: application/json' -d '{"server":"nginx","mode":"detection"}' >/dev/null || echo "modsec: WARN (requires root/packages)"
echo "✓ Smoke tests concluídos"

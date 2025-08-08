// FazAI Tool: agent_supervisor
// Dispara e gerencia agentes (clientes) em outros servidores para coletar
// métricas de processos/rede e enviar para o FazAI via HTTP.
// Pode instalar/atualizar o agente via SSH e configurar beat interval.

const { execSync } = require('child_process');
const fs = require('fs');

exports.info = { name: 'agent_supervisor', description: 'Gerencia agentes remotos para telemetria (processos, rede, atividades)', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const hosts = params.hosts || [];
  const user = params.user || 'root';
  const key = params.key_path || '~/.ssh/id_rsa';
  const interval = Number(params.interval || 30);
  const serverUrl = params.server_url || 'http://localhost:3120/ingest';

  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error('hosts[] requerido');

  const agentScript = `#!/usr/bin/env bash
set -e
SERVER="${serverUrl}"
INTERVAL=${interval}
while true; do
  HOST=$(hostname)
  TS=$(date -Iseconds)
  PSUM=$(ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 20)
  NSTAT=$(ss -s || true)
  IOSTAT=$(iostat -dx 1 1 2>/dev/null || true)
  JSON=$(node -e '
    const os=require("os");
    const fs=require("fs");
    const { execSync } = require("child_process");
    const hostname=os.hostname();
    const load=os.loadavg();
    const mem={ total: os.totalmem(), free: os.freemem() };
    const payload={ hostname, load, mem };
    console.log(JSON.stringify(payload));
  ')
  PAYLOAD=$(cat <<EOF
{
  "hostname": "$HOST",
  "timestamp": "$TS",
  "processes": $(printf '%s' "$PSUM" | jq -Rs .),
  "netstat": $(printf '%s' "$NSTAT" | jq -Rs .),
  "iostat": $(printf '%s' "$IOSTAT" | jq -Rs .),
  "os": $JSON
}
EOF
)
  curl -sS -X POST -H 'Content-Type: application/json' --data "$PAYLOAD" "$SERVER" || true
  sleep $INTERVAL
done
`;

  const results = [];
  for (const h of hosts) {
    const target = `${user}@${h}`;
    try {
      sh(`ssh -i ${key} -o StrictHostKeyChecking=no ${target} 'mkdir -p /opt/fazai-agent && command -v jq >/dev/null 2>&1 || (apt-get update && apt-get install -y jq || dnf install -y jq || yum install -y jq || zypper install -y jq || true)'`);
      sh(`scp -i ${key} -o StrictHostKeyChecking=no /dev/stdin ${target}:/opt/fazai-agent/agent.sh <<'EOF'\n${agentScript}\nEOF`);
      sh(`ssh -i ${key} -o StrictHostKeyChecking=no ${target} 'chmod +x /opt/fazai-agent/agent.sh; (nohup /opt/fazai-agent/agent.sh >/var/log/fazai-agent.log 2>&1 & )'`);
      results.push({ host: h, started: true });
    } catch (e) {
      results.push({ host: h, started: false, error: String(e.message || e) });
    }
  }
  return { success: true, results };
};

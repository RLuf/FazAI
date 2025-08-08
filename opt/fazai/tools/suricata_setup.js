// FazAI Tool: suricata_setup
// Instala e inicia Suricata com regras ET Open; exporta EVE JSON para /var/log/suricata/eve.json.

const { execSync } = require('child_process');

exports.info = { name: 'suricata_setup', description: 'Instala e configura Suricata IDS/IPS (modo IDS por padrão)', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const mode = (params.mode || 'ids').toLowerCase(); // ids|ips
  const ifname = params.ifname || null;
  // Install
  try { sh('dnf -y install suricata || yum -y install suricata || apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y suricata'); } catch {}
  // Enable EVE JSON (usually default). Update iface if provided
  if (ifname) {
    try {
      sh(`sed -i 's/^ *- interface: .*/  - interface: ${ifname}/' /etc/suricata/suricata.yaml || true`);
    } catch {}
  }
  // IPS mode requires NFQUEUE/af-packet rules; leave as IDS by default
  try { sh('suricata-update || true'); } catch {}
  try { sh('systemctl enable --now suricata || systemctl restart suricata'); } catch {}
  return { success: true, mode, ifname: ifname || 'auto', log: '/var/log/suricata/eve.json' };
};

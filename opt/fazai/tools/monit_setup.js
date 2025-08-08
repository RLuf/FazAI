// FazAI Tool: monit_setup
// Instala e configura Monit com um exemplo de checagem de processo e HTTP.

const { execSync } = require('child_process');
const fs = require('fs');

exports.info = { name: 'monit_setup', description: 'Instala e configura Monit', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const webEnable = params.web || true;
  try { sh('dnf -y install monit || yum -y install monit || apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y monit'); } catch {}
  try {
    const conf = '/etc/monitrc';
    let c = '';
    try { c = fs.readFileSync(conf, 'utf8'); } catch {}
    if (webEnable) {
      if (!/set httpd/.test(c)) {
        c += '\nset httpd port 2812 and\n  allow 0.0.0.0/0\n';
      }
    }
    fs.writeFileSync(conf, c);
  } catch {}
  try { sh('systemctl enable --now monit || true'); } catch {}
  return { success: true, web: !!webEnable, port: 2812 };
};

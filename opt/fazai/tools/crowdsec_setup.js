// FazAI Tool: crowdsec_setup
// Instala e configura CrowdSec com bouncers (nginx/apache/iptables) quando possível.

const { execSync } = require('child_process');

exports.info = { name: 'crowdsec_setup', description: 'Instala CrowdSec e bouncers apropriados', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const bouncer = (params.bouncer || 'nginx').toLowerCase(); // nginx|apache|iptables
  try {
    sh('dnf -y install crowdsec || yum -y install crowdsec || apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y crowdsec');
    if (bouncer === 'nginx') sh('dnf -y install crowdsec-bouncer-nginx || apt-get install -y crowdsec-bouncer-nginx || true');
    if (bouncer === 'apache') sh('dnf -y install crowdsec-bouncer-apache2 || apt-get install -y crowdsec-bouncer-apache2 || true');
    if (bouncer === 'iptables') sh('dnf -y install crowdsec-firewall-bouncer || apt-get install -y crowdsec-firewall-bouncer-iptables || true');
    sh('systemctl enable --now crowdsec || true');
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true, bouncer };
};

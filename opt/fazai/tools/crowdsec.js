/*
 * FazAI - Tool: crowdsec
 * Instala e configura CrowdSec (agente e bouncers). Suporte básico Debian/RedHat.
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const info = {
  name: 'crowdsec',
  description: 'Instala CrowdSec e habilita a mitigação básica',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function detectDistro() {
  try {
    const { stdout } = await execPromise('awk -F= \'$1=="ID"{print $2}\' /etc/os-release');
    const id = stdout.trim().replace(/"/g, '');
    if (id.includes('ubuntu') || id.includes('debian')) return 'debian';
    if (id.includes('fedora') || id.includes('centos') || id.includes('rhel') || id.includes('rocky') || id.includes('almalinux')) return 'redhat';
    return 'unknown';
  } catch (_) { return 'unknown'; }
}

async function installCrowdSec(distro) {
  if (distro === 'debian') {
    await execPromise('apt-get update');
    await execPromise('DEBIAN_FRONTEND=noninteractive apt-get install -y crowdsec crowdsec-firewall-bouncer-iptables');
  } else if (distro === 'redhat') {
    await execPromise('dnf install -y crowdsec crowdsec-firewall-bouncer');
  } else {
    throw new Error('Distribuição não suportada automaticamente');
  }
}

async function enableServices() {
  await execPromise('systemctl enable --now crowdsec');
  // Bouncer pode ter nomes distintos
  await execPromise('systemctl enable --now crowdsec-firewall-bouncer || systemctl enable --now crowdsec-firewall-bouncer-iptables || true');
}

async function run(params = {}) {
  const distro = await detectDistro();
  await installCrowdSec(distro);
  await enableServices();
  return { success: true, message: 'CrowdSec instalado e habilitado', params };
}

module.exports = { info, run };

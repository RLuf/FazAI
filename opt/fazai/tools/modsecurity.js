/*
 * FazAI - Tool: modsecurity
 * Instala e configura ModSecurity (Apache) com OWASP CRS básico
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const info = {
  name: 'modsecurity',
  description: 'Instala ModSecurity e OWASP Core Rule Set em Apache',
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

async function installModSec(distro) {
  if (distro === 'debian') {
    await execPromise('apt-get update');
    await execPromise('DEBIAN_FRONTEND=noninteractive apt-get install -y apache2 libapache2-mod-security2');
    await execPromise('a2enmod security2');
  } else if (distro === 'redhat') {
    await execPromise('dnf install -y httpd mod_security');
  } else {
    throw new Error('Distribuição não suportada automaticamente');
  }
}

async function installCRS() {
  await execPromise('bash -lc "test -d /etc/modsecurity.d/owasp-crs || git clone --depth 1 https://github.com/coreruleset/coreruleset /etc/modsecurity.d/owasp-crs"');
  await execPromise('bash -lc "cp -n /etc/modsecurity.d/owasp-crs/crs-setup.conf.example /etc/modsecurity.d/owasp-crs/crs-setup.conf || true"');
  await execPromise('bash -lc "grep -q owasp-crs.conf /etc/apache2/mods-enabled/security2.conf || echo \"IncludeOptional /etc/modsecurity.d/owasp-crs/crs-setup.conf\nIncludeOptional /etc/modsecurity.d/owasp-crs/rules/*.conf\" | tee -a /etc/apache2/mods-enabled/security2.conf" || true');
}

async function enableServices(distro) {
  if (distro === 'debian') {
    await execPromise('systemctl enable --now apache2');
  } else {
    await execPromise('systemctl enable --now httpd');
  }
}

async function run(params = {}) {
  const distro = await detectDistro();
  await installModSec(distro);
  await installCRS();
  await enableServices(distro);
  return { success: true, message: 'ModSecurity + OWASP CRS instalado e habilitado', params };
}

module.exports = { info, run };

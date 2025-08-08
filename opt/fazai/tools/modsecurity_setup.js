// FazAI Tool: modsecurity_setup
// Instala e configura ModSecurity + OWASP CRS para Nginx ou Apache.
// Tenta usar dnf/yum ou apt. Define modo de detecção por padrão.

const { execSync } = require('child_process');
const fs = require('fs');

exports.info = { name: 'modsecurity_setup', description: 'Instala e configura ModSecurity + OWASP CRS (Nginx/Apache)', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

function detectPkgManager() {
  try { sh('command -v dnf'); return 'dnf'; } catch {}
  try { sh('command -v yum'); return 'yum'; } catch {}
  try { sh('command -v apt'); return 'apt'; } catch {}
  return null;
}

exports.run = async function(params = {}) {
  const server = (params.server || '').toLowerCase(); // 'nginx' | 'apache'
  const mode = (params.mode || 'detection').toLowerCase(); // detection|blocking
  const pm = detectPkgManager();
  if (!pm) throw new Error('Nenhum gerenciador de pacotes suportado encontrado (dnf/yum/apt)');

  // Instala pacotes
  try {
    if (pm === 'dnf' || pm === 'yum') {
      sh(`${pm} -y install mod_security mod_security_crs || ${pm} -y install mod_security mod_security_crs nginx-mod-http-modsecurity || true`);
      if (server === 'nginx') {
        // Habilitar no nginx
        // Tenta incluir a diretiva load_module e modsecurity on em um drop-in
        try { fs.mkdirSync('/etc/nginx/conf.d', { recursive: true }); } catch {}
        const conf = '/etc/nginx/conf.d/modsecurity.conf';
        fs.writeFileSync(conf, `modsecurity on;\nmodsecurity_rules_file /etc/nginx/modsecurity.d/modsecurity.conf;\n`);
      } else {
        // Apache
        // mod_security é carregado automaticamente, criar inclusão CRS
        try { fs.mkdirSync('/etc/httpd/conf.d', { recursive: true }); } catch {}
        const conf = '/etc/httpd/conf.d/modsecurity.conf';
        fs.writeFileSync(conf, `SecRuleEngine ${mode === 'blocking' ? 'On' : 'DetectionOnly'}\nIncludeOptional "/etc/modsecurity.d/owasp-crs/crs-setup.conf"\nIncludeOptional "/etc/modsecurity.d/owasp-crs/rules/*.conf"\n`);
      }
    } else if (pm === 'apt') {
      sh('apt-get update -y');
      sh('DEBIAN_FRONTEND=noninteractive apt-get install -y libmodsecurity3 modsecurity-crs || true');
      if (server === 'nginx') {
        sh('DEBIAN_FRONTEND=noninteractive apt-get install -y nginx libnginx-mod-security');
        try { fs.mkdirSync('/etc/nginx/modsecurity', { recursive: true }); } catch {}
        const conf = '/etc/nginx/modsecurity/modsecurity.conf';
        fs.writeFileSync(conf, `SecRuleEngine ${mode === 'blocking' ? 'On' : 'DetectionOnly'}\nInclude "/usr/share/modsecurity-crs/crs-setup.conf"\nInclude "/usr/share/modsecurity-crs/rules/*.conf"\n`);
        try { fs.mkdirSync('/etc/nginx/conf.d', { recursive: true }); } catch {}
        fs.writeFileSync('/etc/nginx/conf.d/modsecurity.conf', `modsecurity on;\nmodsecurity_rules_file ${conf};\n`);
      } else {
        sh('DEBIAN_FRONTEND=noninteractive apt-get install -y apache2 libapache2-mod-security2');
        sh('a2enmod security2 || true');
        const conf = '/etc/modsecurity/modsecurity.conf';
        try { fs.mkdirSync('/etc/modsecurity', { recursive: true }); } catch {}
        fs.writeFileSync(conf, `SecRuleEngine ${mode === 'blocking' ? 'On' : 'DetectionOnly'}\nInclude "/usr/share/modsecurity-crs/crs-setup.conf"\nInclude "/usr/share/modsecurity-crs/rules/*.conf"\n`);
      }
    }
  } catch (e) {
    // continua mas retorna erro
    return { success: false, error: e.message };
  }

  // Reload serviço
  try {
    if (server === 'nginx') sh('systemctl restart nginx || true');
    if (server === 'apache') sh('systemctl restart httpd || systemctl restart apache2 || true');
  } catch {}

  return { success: true, server: server || 'auto', mode };
};

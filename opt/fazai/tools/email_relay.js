/*
 * FazAI - Tool: email_relay
 * Orquestra instalação e configuração de relay de e-mail com filtros (Postfix + SpamAssassin/Amavis)
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const info = {
  name: 'email_relay',
  description: 'Instala e configura Postfix relay com filtros antispam (spamassassin/spamd) e integrações comuns',
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

async function installPackages(distro) {
  if (distro === 'debian') {
    await execPromise('apt-get update');
    await execPromise('DEBIAN_FRONTEND=noninteractive apt-get install -y postfix postfix-pcre spamassassin spamc');
  } else if (distro === 'redhat') {
    await execPromise('dnf install -y postfix spamassassin');
  } else {
    throw new Error('Distribuição não suportada automaticamente');
  }
}

async function enableServices() {
  await execPromise('systemctl enable --now postfix');
  await execPromise('systemctl enable --now spamassassin || systemctl enable --now spamd || true');
}

async function configurePostfixRelay({ relayhost = '', myhostname = '', mynetworks = '127.0.0.0/8', inet_interfaces = 'all' }) {
  const postconf = async (k, v) => execPromise(`postconf -e '${k} = ${v}'`);
  if (myhostname) await postconf('myhostname', myhostname);
  await postconf('mynetworks', mynetworks);
  await postconf('inet_interfaces', inet_interfaces);
  if (relayhost) await postconf('relayhost', relayhost);
  // Integração com SpamAssassin via content_filter
  await postconf('content_filter', 'spamassassin:dummy');
  // Master.cf: adiciona serviço spamassassin
  await execPromise("bash -lc 'grep -q "^spamassassin" /etc/postfix/master.cf || printf "\nspamassassin  unix  -       n       n       -       -       pipe\n  user=spamd argv=/usr/bin/spamc -f -e /usr/sbin/sendmail -oi -f \"${sender}\" -- ${recipient}\n" | tee -a /etc/postfix/master.cf' ");
  await execPromise('systemctl restart postfix');
}

async function run(params = {}) {
  const distro = await detectDistro();
  await installPackages(distro);
  await enableServices();
  await configurePostfixRelay(params);
  return { success: true, message: 'Postfix relay instalado e configurado', params };
}

module.exports = {
  info,
  run,
};

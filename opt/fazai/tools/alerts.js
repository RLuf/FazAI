/*
 * FazAI - Tool: alerts
 * Envia alertas por e-mail (mail/sendmail) e Telegram
 */

const { exec } = require('child_process');
const util = require('util');
const { fetchPost } = require('./http_fetch');
const execPromise = util.promisify(exec);

const info = {
  name: 'alerts',
  description: 'Alertas por email e Telegram',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function email({ to, subject, message }) {
  if (!to || !subject || !message) return { success: false, error: 'to, subject, message são obrigatórios' };
  try {
    // Tenta com mailx/mail, cai para sendmail
    try {
      await execPromise(`bash -lc 'echo ${JSON.stringify(message)} | mail -s ${JSON.stringify(subject)} ${JSON.stringify(to)}'`);
      return { success: true };
    } catch (_) {}
    const payload = `To: ${to}\nSubject: ${subject}\n\n${message}\n`;
    await execPromise(`bash -lc 'printf %s ${JSON.stringify(payload)} | sendmail -t'`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function telegram({ botToken, chatId, message }) {
  if (!botToken || !chatId || !message) return { success: false, error: 'botToken, chatId e message são obrigatórios' };
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetchPost(url, { chat_id: chatId, text: message });
  return { success: res.statusCode === 200, status: res.statusCode };
}

async function whatsapp({ webhookUrl, message, to }) {
  if (!webhookUrl || !message) return { success: false, error: 'webhookUrl e message são obrigatórios' };
  // Envia para um webhook genérico (integração via middleware próprio)
  const res = await fetchPost(webhookUrl, { to, message });
  return { success: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode };
}

async function run(params) {
  if (params?.channel === 'email') return email(params);
  if (params?.channel === 'telegram') return telegram(params);
  if (params?.channel === 'whatsapp') return whatsapp(params);
  return { success: false, error: 'Canal não suportado. Use channel=email|telegram|whatsapp' };
}

module.exports = { info, run, email, telegram, whatsapp };

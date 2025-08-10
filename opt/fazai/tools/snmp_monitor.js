// FazAI Tool: snmp_monitor
// Consulta OIDs SNMP de um host e retorna métricas em JSON.
// Requer snmpwalk/snmpget instalados (net-snmp).

const { execSync } = require('child_process');

exports.info = { name: 'snmp_monitor', description: 'Consulta OIDs via SNMP (v2c por padrão)', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const host = params.host || '127.0.0.1';
  const community = params.community || 'public';
  const version = params.version || '2c';
  const oids = params.oids || ['1.3.6.1.2.1.1.1.0']; // sysDescr
  const timeout = Number(params.timeout || 5);

  // Verificação básica
  try { sh('snmpwalk -V >/dev/null 2>&1'); } catch { throw new Error('snmpwalk não encontrado (instale net-snmp)'); }

  const results = {};
  for (const oid of oids) {
    try {
      const out = sh(`snmpget -v${version} -c ${community} -t ${timeout} -Ovq ${host} ${oid}`);
      results[oid] = out.trim();
    } catch (e) {
      results[oid] = { error: String(e.message || e) };
    }
  }
  return { success: true, host, version, oids, results };
};

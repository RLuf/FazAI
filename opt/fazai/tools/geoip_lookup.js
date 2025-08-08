/*
 * FazAI - Tool: geoip_lookup
 * Consulta GeoIP para IPs/domínios usando APIs públicas (ip-api.com como padrão)
 */

const { fetchGet } = require('./http_fetch');

const info = {
  name: 'geoip_lookup',
  description: 'Consulta informações GeoIP (país, cidade, ASN, etc.)',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function lookup({ ip, host, provider = 'ip-api' } = {}) {
  const target = ip || host;
  if (!target) return { success: false, error: 'Parâmetro ip ou host é obrigatório' };

  if (provider === 'ip-api') {
    const url = `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,continent,country,regionName,city,lat,lon,isp,org,as,query`;
    const { statusCode, body } = await fetchGet(url);
    if (statusCode !== 200) return { success: false, error: `HTTP ${statusCode}` };
    let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
    if (data.status !== 'success') return { success: false, error: data.message || 'Falha na consulta' };
    return { success: true, data };
  }

  return { success: false, error: `Provider não suportado: ${provider}` };
}

module.exports = { info, lookup, run: lookup };

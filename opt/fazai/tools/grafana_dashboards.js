/*
 * FazAI Tool: grafana_dashboards
 * Gera JSONs de dashboards para Suricata/ClamAV/OPNsense (Prometheus /metrics) e salva em /var/lib/fazai/dashboards
 */

const fs = require('fs');
const path = require('path');

exports.info = { name: 'grafana_dashboards', description: 'Gera dashboards de exemplo para Grafana (Prometheus)', interactive: false };

function writeJson(p, obj){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

exports.run = async function(){
  const base = '/var/lib/fazai/dashboards';
  // Painel simples com 3 gráficos
  const dash = {
    annotations: { list: [] },
    panels: [
      { type: 'graph', title: 'Ingest Total', targets: [{ expr: 'fazai_ingest_total' }], gridPos: { x:0,y:0,w:12,h:6 } },
      { type: 'table', title: 'Suricata Assinaturas', targets: [{ expr: 'sum by (signature) (suricata_alert_total)' }], gridPos: { x:0,y:6,w:12,h:8 } },
      { type: 'table', title: 'ClamAV Vírus', targets: [{ expr: 'sum by (name) (clamav_virus_total)' }], gridPos: { x:0,y:14,w:12,h:8 } },
      { type: 'stat', title: 'OPNsense Fleet OK', targets: [{ expr: 'opnsense_fleet_ok' }], gridPos: { x:12,y:0,w:12,h:6 } },
      { type: 'stat', title: 'OPNsense Fleet Degraded', targets: [{ expr: 'opnsense_fleet_degraded' }], gridPos: { x:12,y:6,w:12,h:6 } },
      { type: 'stat', title: 'OPNsense Fleet Down', targets: [{ expr: 'opnsense_fleet_down' }], gridPos: { x:12,y:12,w:12,h:6 } }
    ],
    title: 'FazAI Security Overview',
    refresh: '10s',
    time: { from: 'now-6h', to: 'now' }
  };
  writeJson(path.join(base, 'fazai_security_overview.json'), dash);
  return { success: true, path: base, files: ['fazai_security_overview.json'] };
};


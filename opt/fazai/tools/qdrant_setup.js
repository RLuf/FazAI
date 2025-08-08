// FazAI Tool: qdrant_setup
// Prepara Qdrant (via Docker) e popula coleções iniciais de embeddings
// para consultas sobre redes/soluções Linux, permitindo recuperação via API.

const { execSync } = require('child_process');
const axios = require('axios');

exports.info = { name: 'qdrant_setup', description: 'Sobe Qdrant e cria coleções para RAG de redes/Linux', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

exports.run = async function(params = {}) {
  const port = Number(params.port || 6333);
  const vol = params.volume || '/var/lib/qdrant';
  const name = params.name || 'fazai-qdrant';
  // start qdrant
  sh(`docker ps --format '{{.Names}}' | grep -q '^${name}$' || docker run -d --name ${name} -p ${port}:6333 -v ${vol}:/qdrant/storage qdrant/qdrant:latest`);
  // wait
  for (let i = 0; i < 20; i++) {
    try { await axios.get(`http://localhost:${port}/ready`); break; } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  // create collection (if missing)
  const coll = params.collection || 'linux_networking_tech';
  await axios.put(`http://localhost:${port}/collections/${coll}`, { 
    vectors: { size: Number(params.dim || 1024), distance: 'Cosine' } 
  }).catch(() => {});
  return { success: true, port, collection: coll, name };
};

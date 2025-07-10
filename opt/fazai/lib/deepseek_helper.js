const axios = require('axios');

// Chave de API padrão para fallback DeepSeek
// Atualizada para a nova chave fornecida pelo usuário
const DEFAULT_KEY = ''; // Insira sua chave de API aqui';
const DEFAULT_MODEL = 'gpt-4o-mini';
const ENDPOINT = 'https://api.openai.com/v1';

/**
 * Consulta o modelo DeepSeek da OpenRouter com a chave padrão.
 * Usado como fallback durante a instalação e em execuções do FazAI.
 * @param {string} prompt - Mensagem ou problema a ser consultado.
 * @returns {Promise<{success:boolean, content?:string, error?:string}>}
 */
async function deepseekFallback(prompt) {
  try {
    const response = await axios.post(`${ENDPOINT}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Authorization': `Bearer ${DEFAULT_KEY}`,
        'HTTP-Referer': 'https://github.com/RLuf/FazAI',
        'X-Title': 'FazAI Fallback',
        'Content-Type': 'application/json'
      }
    });
    const content = response.data.choices[0].message.content;
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { deepseekFallback };

// Permite uso como CLI durante instalação
if (require.main === module) {
  const prompt = process.argv.slice(2).join(' ') || 'Problema não especificado.';
  deepseekFallback(prompt).then(res => {
    if (res.success) {
      console.log(res.content);
      process.exit(0);
    } else {
      console.error('DeepSeek error:', res.error);
      process.exit(1);
    }
  });
}

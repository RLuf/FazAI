const axios = require('axios');

// Chave de API padrão para fallback conforme AGENTS.md
const DEFAULT_KEY = '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';
const DEFAULT_MODEL = 'deepseek/deepseek-r1-0528:free';
const ENDPOINT = 'https://openrouter.ai/api/v1';

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
    } else {
      console.error('DeepSeek error:', res.error);
    }
  });
}

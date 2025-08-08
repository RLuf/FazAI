#!/usr/bin/env node

/**
 * genaiscript - Script utilitário para testar o módulo DeepSeek
 *
 * Este script envia um prompt para o módulo deepseek_helper e
 * exibe a resposta no terminal. Útil para validar a comunicação
 * com o modelo DeepSeek via OpenRouter.
 */

const { deepseekFallback } = require('../opt/fazai/lib/deepseek_helper');

// Captura o texto informado na linha de comando
const prompt = process.argv.slice(2).join(' ') ||
  'Digite uma mensagem para o DeepSeek.';

// Executa a consulta e imprime o resultado
deepseekFallback(prompt).then(res => {
  if (res.success) {
    console.log(res.content);
  } else {
    console.error('Erro ao consultar DeepSeek:', res.error);
  }
});

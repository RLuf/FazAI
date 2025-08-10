#!/usr/bin/env node

/**
 * FazAI - genaiscript (stub)
 *
 * Gera um plano JSON mínimo para comandos complexos quando o arquitetador
 * externo não está disponível. O objetivo é não quebrar o fluxo do daemon
 * e permitir uma execução segura por padrão.
 */

function buildMinimalPlan() {
  return {
    needs_agent: false,
    required_info: [],
    steps: [
      // Passo inofensivo para confirmar que o arquitetamento foi acionado
      'echo "FazAI: arquitetador mínimo - nenhum passo específico gerado"'
    ],
    dependencies: [],
    monitoring: [],
    notifications: [],
    estimated_time: 'instantaneo',
    complexity: 'baixa'
  };
}

try {
  // Ignora o conteúdo do prompt por ora; futura integração poderá analisar
  const plan = buildMinimalPlan();
  process.stdout.write(JSON.stringify(plan));
  process.exit(0);
} catch (err) {
  process.stderr.write(`genaiscript error: ${err.message}`);
  process.exit(1);
}

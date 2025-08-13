#!/usr/bin/env node

/**
 * FazAI Agent Prompt Builder
 * 
 * Este módulo constrói prompts estruturados para o agente,
 * incluindo regras do protocolo ND-JSON, contexto e histórico.
 */

/**
 * Constrói o prompt para o agente
 * @param {Object} params - Parâmetros do prompt
 * @param {string} params.objective - Objetivo a ser alcançado
 * @param {Array} params.ctx - Contexto recuperado
 * @param {Array} params.history - Histórico da sessão
 * @returns {string} Prompt completo
 */
async function buildPrompt({ objective, ctx, history = [] }) {
    const rules = `
Você é um agente operacional inteligente. Responda APENAS em JSON por linha, usando os seguintes tipos: plan, ask, research, shell, tool_spec, use_tool, observe, commit_kb, done.

REGRAS OBRIGATÓRIAS:
- UMA ação por iteração apenas
- Se precisar criar ferramenta, emita tool_spec antes de use_tool
- Em caso de ambiguidade, use research ou ask
- Comandos shell devem ser completos em linha única
- Sempre observe após executar uma ação
- Conclua cada iteração com done
- Use plan para organizar próximos passos
- Use ask para resolver ambiguidades com o usuário
- Use research para buscar conhecimento externo
- Use shell para comandos diretos no sistema
- Use tool_spec + use_tool para ferramentas reutilizáveis
- Use observe para resumir o que foi feito
- Use commit_kb para salvar conhecimento
- Use done para finalizar iteração

FORMATO DE RESPOSTA:
Cada linha deve ser um JSON válido com o campo "type" obrigatório.
`.trim();

    // Construir seção de contexto
    const contextSection = ctx && ctx.length > 0 
        ? "CONTEXTO RECUPERADO:\n" + ctx.map(x => `- ${x}`).join("\n")
        : "CONTEXTO: Nenhum contexto relevante encontrado.";

    // Construir seção de histórico
    const historySection = history && history.length > 0
        ? "HISTÓRICO DA SESSÃO:\n" + JSON.stringify(history, null, 2)
        : "HISTÓRICO: Sessão iniciada.";

    // Construir prompt final
    const prompt = [
        rules,
        "",
        contextSection,
        "",
        historySection,
        "",
        "OBJETIVO:",
        objective,
        "",
        "SAÍDA: JSON por linha."
    ].join("\n");

    return prompt;
}

/**
 * Constrói prompt específico para planejamento
 * @param {string} objective - Objetivo
 * @param {Array} ctx - Contexto
 * @returns {string} Prompt de planejamento
 */
function buildPlanningPrompt(objective, ctx = []) {
    return buildPrompt({
        objective: `Planeje uma solução para: ${objective}`,
        ctx: ctx,
        history: []
    });
}

/**
 * Constrói prompt específico para execução
 * @param {string} objective - Objetivo
 * @param {Array} ctx - Contexto
 * @param {Array} plan - Plano a ser executado
 * @returns {string} Prompt de execução
 */
function buildExecutionPrompt(objective, ctx = [], plan = []) {
    const planSection = plan.length > 0 
        ? `PLANO A EXECUTAR:\n${plan.map((step, i) => `${i+1}. ${step}`).join("\n")}`
        : "";

    const prompt = buildPrompt({
        objective: objective,
        ctx: ctx,
        history: []
    });

    return prompt + "\n\n" + planSection;
}

/**
 * Constrói prompt para correção de erros
 * @param {string} objective - Objetivo original
 * @param {string} error - Erro ocorrido
 * @param {Array} ctx - Contexto atual
 * @returns {string} Prompt de correção
 */
function buildErrorCorrectionPrompt(objective, error, ctx = []) {
    const errorSection = `
ERRO OCORRIDO:
${error}

TAREFA: Analise o erro e proponha uma correção ou alternativa.
`;

    return buildPrompt({
        objective: objective + "\n" + errorSection,
        ctx: ctx,
        history: []
    });
}

module.exports = {
    buildPrompt,
    buildPlanningPrompt,
    buildExecutionPrompt,
    buildErrorCorrectionPrompt
};
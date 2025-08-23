#!/usr/bin/env node

/**
 * FazAI Agent Handlers
 * 
 * Este módulo implementa os handlers para o sistema de agentes inteligentes,
 * processando ações ND-JSON e gerenciando sessões de IA.
 */

const express = require('express');
const { createSession, generateStream, abort } = require('../providers/gemma-worker');
const { buildPrompt } = require('../core/prompt/agent_prompt');
const { searchContext } = require('../core/retrieval');
const { runShellStream } = require('../core/shell');
const { doResearch } = require('../core/research');
const { codegenAndLoad, useTool } = require('../core/tools_codegen');
const { kbCommit } = require('../core/kb');

/**
 * Monta as rotas do agente no app Express
 * @param {express.Application} app - Aplicação Express
 */
function mountAgent(app) {
    
    /**
     * POST /agent/sessions
     * Cria uma nova sessão de agente
     */
    app.post("/agent/sessions", async (req, res) => {
        try {
            const params = req.body.params || {};
            const sid = await createSession(params);
            res.json({ ok: true, session_id: sid });
        } catch (error) {
            console.error('Erro ao criar sessão:', error);
            res.status(500).json({ 
                ok: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /agent/generate
     * Gera resposta do agente com streaming SSE
     */
    app.post("/agent/generate", async (req, res) => {
        const { session_id, objective, history = [] } = req.body;
        
        if (!session_id || !objective) {
            return res.status(400).json({
                ok: false,
                error: "session_id e objective são obrigatórios"
            });
        }

        // Configurar SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        const send = (obj) => {
            res.write(`data: ${JSON.stringify(obj)}\n\n`);
        };

        try {
            // Recuperar contexto
            const ctx = await searchContext(objective, history);
            
            // Construir prompt
            const prompt = await buildPrompt({ objective, ctx, history });
            
            // Iniciar stream de geração
            const stream = generateStream(session_id, prompt);
            
            let buffer = "";
            let actionIssued = false;

            stream.on("event", async (evt) => {
                if (evt.type === "token") {
                    buffer += evt.text;
                    send({ type: "token", text: evt.text });
                    
                    // Verificar por linhas JSON completas
                    const lastNewline = buffer.lastIndexOf("\n");
                    if (lastNewline >= 0) {
                        const lines = buffer.slice(0, lastNewline).split("\n");
                        buffer = buffer.slice(lastNewline + 1);
                        
                        for (const line of lines) {
                            try {
                                const action = JSON.parse(line);
                                await handleAction(action, send);
                            } catch (e) {
                                // Ignorar linhas que não são JSON válido
                            }
                        }
                    }
                } else if (evt.type === "stop") {
                    if (!actionIssued) {
                        send({ type: "done" });
                    }
                    res.end();
                }
            });

            stream.on("error", (error) => {
                console.error('Erro no stream:', error);
                send({ type: "error", message: error.message });
                res.end();
            });

            stream.on("end", () => {
                res.end();
            });

        } catch (error) {
            console.error('Erro na geração:', error);
            send({ type: "error", message: error.message });
            res.end();
        }
    });

    /**
     * POST /agent/abort
     * Aborta a geração atual de uma sessão
     */
    app.post("/agent/abort", async (req, res) => {
        try {
            const { session_id } = req.body;
            
            if (!session_id) {
                return res.status(400).json({
                    ok: false,
                    error: "session_id é obrigatório"
                });
            }

            await abort(session_id);
            res.json({ ok: true });
        } catch (error) {
            console.error('Erro ao abortar:', error);
            res.status(500).json({ 
                ok: false, 
                error: error.message 
            });
        }
    });

    /**
     * GET /agent/status
     * Obtém status do sistema de agentes
     */
    app.get("/agent/status", async (req, res) => {
        try {
            const gemmaWorker = require('../providers/gemma-worker');
            const isAvailable = await gemmaWorker.isAvailable();
            
            res.json({
                ok: true,
                agent_system: "running",
                gemma_worker: isAvailable ? "available" : "unavailable",
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Erro ao obter status:', error);
            res.status(500).json({ 
                ok: false, 
                error: error.message 
            });
        }
    });
}

/**
 * Processa uma ação ND-JSON do agente
 * @param {Object} action - Ação a ser executada
 * @param {Function} send - Função para enviar eventos SSE
 */
async function handleAction(action, send) {
    if (!action?.type) return;

    try {
        switch (action.type) {
            case "plan":
                send({ 
                    type: "plan", 
                    steps: action.steps || [] 
                });
                break;

            case "ask":
                send({ 
                    type: "ask", 
                    question: action.question,
                    options: action.options || []
                });
                break;

            case "research":
                send({ 
                    type: "action", 
                    action: "research", 
                    queries: action.queries 
                });
                
                const docs = await doResearch(action.queries, action.maxDocs || 5);
                send({ type: "research_result", docs });
                break;

            case "shell":
                send({ 
                    type: "action", 
                    action: "shell", 
                    command: action.command 
                });
                
                await runShellStream(action.command, (chunk, stream) => {
                    send({ type: "exec_log", stream, chunk });
                });
                
                send({ type: "observe", note: "shell_done" });
                send({ type: "done" });
                break;

            case "tool_spec":
                send({ 
                    type: "action", 
                    action: "tool_spec", 
                    name: action.name 
                });
                
                await codegenAndLoad(action);
                send({ type: "observe", note: "tool_generated" });
                send({ type: "done" });
                break;

            case "use_tool":
                send({ 
                    type: "action", 
                    action: "use_tool", 
                    name: action.name, 
                    args: action.args 
                });
                
                await useTool(action.name, action.args, (chunk, stream) => {
                    send({ type: "exec_log", stream, chunk });
                });
                
                send({ type: "observe", note: "tool_done" });
                send({ type: "done" });
                break;

            case "commit_kb":
                await kbCommit(action);
                send({ type: "observe", note: "kb_committed" });
                break;

            case "observe":
                send({ 
                    type: "observe", 
                    note: action.summary 
                });
                break;

            case "done":
                send({ 
                    type: "done", 
                    result: action.result 
                });
                break;

            default:
                console.warn('Ação desconhecida:', action.type);
                break;
        }
    } catch (error) {
        console.error('Erro ao executar ação:', error);
        send({ 
            type: "error", 
            message: `Erro na ação ${action.type}: ${error.message}` 
        });
    }
}

module.exports = {
    mountAgent,
    handleAction
};
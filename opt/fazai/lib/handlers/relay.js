#!/usr/bin/env node

/**
 * FazAI Relay Handler
 * 
 * Handler específico para integração com sistema de relay SMTP
 */

const RelayIntegration = require('../core/relay_integration');

function mountRelay(app) {
    const relay = new RelayIntegration();
    
    // Rota para análise de configuração
    app.post('/relay/analyze', async (req, res) => {
        try {
            const result = await relay.analyzeRelayConfig();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para configuração automática
    app.post('/relay/configure', async (req, res) => {
        try {
            const result = await relay.configureRelay(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para monitoramento de logs
    app.get('/relay/monitor', async (req, res) => {
        try {
            const result = await relay.monitorRelayLogs();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para estatísticas
    app.get('/relay/stats', async (req, res) => {
        try {
            const result = await relay.getRelayStats();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para integração com SpamExperts
    app.post('/relay/spamexperts', async (req, res) => {
        try {
            const result = await relay.integrateSpamExperts(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para integração com Zimbra
    app.post('/relay/zimbra', async (req, res) => {
        try {
            const result = await relay.integrateZimbra(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para resposta a ataques
    app.post('/relay/respond-attack', async (req, res) => {
        try {
            const result = await relay.respondToAttack(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para adicionar IP à blacklist
    app.post('/relay/blacklist', async (req, res) => {
        try {
            const { ip } = req.body;
            if (!ip) {
                return res.status(400).json({
                    ok: false,
                    error: 'IP é obrigatório'
                });
            }
            
            const result = await relay.addToBlacklist(ip);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
    
    // Rota para reiniciar relay
    app.post('/relay/restart', async (req, res) => {
        try {
            const result = await relay.restartRelay();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                ok: false,
                error: error.message
            });
        }
    });
}

module.exports = { mountRelay };
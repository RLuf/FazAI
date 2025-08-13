#!/usr/bin/env node
/**
 * DOCLER Web Server
 * Servidor web para as interfaces DOCLER com WebSocket
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

class DoclerWebServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3120,
            adminPort: config.adminPort || 3121,
            ...config
        };
        
        this.app = express();
        this.adminApp = express();
        this.server = null;
        this.adminServer = null;
        this.wss = null;
        this.adminWss = null;
        
        this.clients = new Set();
        this.adminClients = new Set();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupMiddleware() {
        // Middleware para cliente
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
        
        // Middleware para admin
        this.adminApp.use(express.json());
        this.adminApp.use(express.static(path.join(__dirname)));
        this.adminApp.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }
    
    setupRoutes() {
        // Rotas para cliente
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'docler-interface.html'));
        });
        
        this.app.get('/client', (req, res) => {
            res.sendFile(path.join(__dirname, 'docler-interface.html'));
        });
        
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                uptime: process.uptime(),
                clients: this.clients.size,
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.post('/api/command', (req, res) => {
            const { command, args } = req.body;
            this.handleCommand(command, args);
            res.json({ success: true, message: `Comando ${command} executado` });
        });
        
        // Rotas para admin
        this.adminApp.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'docler-admin.html'));
        });
        
        this.adminApp.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'docler-admin.html'));
        });
        
        this.adminApp.get('/api/admin/status', (req, res) => {
            res.json({
                status: 'online',
                uptime: process.uptime(),
                adminClients: this.adminClients.size,
                totalClients: this.clients.size + this.adminClients.size,
                timestamp: new Date().toISOString()
            });
        });
        
        this.adminApp.post('/api/admin/action', (req, res) => {
            const { action, target, params } = req.body;
            this.handleAdminAction(action, target, params);
            res.json({ success: true, message: `Ação ${action} executada` });
        });
        
        // API para dados do sistema
        this.app.get('/api/system/stats', (req, res) => {
            res.json(this.getSystemStats());
        });
        
        this.adminApp.get('/api/admin/system/stats', (req, res) => {
            res.json(this.getSystemStats());
        });
        
        // API para serviços
        this.app.get('/api/services', (req, res) => {
            res.json(this.getServicesStatus());
        });
        
        this.adminApp.get('/api/admin/services', (req, res) => {
            res.json(this.getServicesStatus());
        });
        
        // API para logs
        this.app.get('/api/logs', (req, res) => {
            const { level, service, limit } = req.query;
            res.json(this.getLogs(level, service, limit));
        });
        
        this.adminApp.get('/api/admin/logs', (req, res) => {
            const { level, service, limit } = req.query;
            res.json(this.getLogs(level, service, limit));
        });
    }
    
    setupWebSocket() {
        // WebSocket para cliente
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws, req) => {
            console.log('Cliente DOCLER conectado');
            this.clients.add(ws);
            
            // Enviar status inicial
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'DOCLER conectado com sucesso!',
                timestamp: new Date().toISOString()
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('Erro ao processar mensagem WebSocket:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('Cliente DOCLER desconectado');
                this.clients.delete(ws);
            });
        });
        
        // WebSocket para admin
        this.adminServer = http.createServer(this.adminApp);
        this.adminWss = new WebSocket.Server({ server: this.adminServer });
        
        this.adminWss.on('connection', (ws, req) => {
            console.log('Admin DOCLER conectado');
            this.adminClients.add(ws);
            
            // Enviar status inicial
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'Admin DOCLER conectado com sucesso!',
                timestamp: new Date().toISOString()
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleAdminWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('Erro ao processar mensagem WebSocket Admin:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('Admin DOCLER desconectado');
                this.adminClients.delete(ws);
            });
        });
    }
    
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'command':
                this.handleCommand(data.command, data.args);
                break;
            case 'get_status':
                ws.send(JSON.stringify({
                    type: 'status',
                    data: this.getSystemStats()
                }));
                break;
            case 'get_face_update':
                ws.send(JSON.stringify({
                    type: 'face_update',
                    mood: this.getRandomMood(),
                    timestamp: new Date().toISOString()
                }));
                break;
            default:
                console.log('Mensagem WebSocket desconhecida:', data);
        }
    }
    
    handleAdminWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'admin_action':
                this.handleAdminAction(data.action, data.target, data.params);
                break;
            case 'get_dashboard':
                ws.send(JSON.stringify({
                    type: 'dashboard_update',
                    data: this.getDashboardData()
                }));
                break;
            case 'get_services':
                ws.send(JSON.stringify({
                    type: 'services_update',
                    data: this.getServicesStatus()
                }));
                break;
            default:
                console.log('Mensagem WebSocket Admin desconhecida:', data);
        }
    }
    
    handleCommand(command, args = []) {
        console.log(`Comando executado: ${command}`, args);
        
        // Simular execução de comando
        const response = {
            type: 'command_response',
            command: command,
            success: true,
            message: `Comando ${command} executado com sucesso`,
            timestamp: new Date().toISOString()
        };
        
        // Enviar resposta para todos os clientes
        this.broadcastToClients(response);
        
        // Atualizar face DOCLER
        this.updateDoclerFace(command);
    }
    
    handleAdminAction(action, target, params = {}) {
        console.log(`Ação admin: ${action} em ${target}`, params);
        
        const response = {
            type: 'admin_action_response',
            action: action,
            target: target,
            success: true,
            message: `Ação ${action} em ${target} executada com sucesso`,
            timestamp: new Date().toISOString()
        };
        
        // Enviar resposta para todos os admins
        this.broadcastToAdmins(response);
        
        // Atualizar dashboard se necessário
        if (action === 'restart' || action === 'update') {
            setTimeout(() => {
                this.broadcastToAdmins({
                    type: 'dashboard_update',
                    data: this.getDashboardData()
                });
            }, 2000);
        }
    }
    
    updateDoclerFace(command) {
        const moods = {
            'agent': 'focused',
            'relay': 'thinking',
            'monitor': 'observing',
            'security': 'determined',
            'admin': 'surprised'
        };
        
        const mood = moods[command] || 'observing';
        
        this.broadcastToClients({
            type: 'face_update',
            mood: mood,
            timestamp: new Date().toISOString()
        });
    }
    
    getRandomMood() {
        const moods = ['observing', 'thinking', 'happy', 'focused', 'surprised', 'determined', 'satisfied'];
        return moods[Math.floor(Math.random() * moods.length)];
    }
    
    getSystemStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            clients: this.clients.size,
            adminClients: this.adminClients.size,
            timestamp: new Date().toISOString()
        };
    }
    
    getDashboardData() {
        return {
            system: {
                uptime: '2d 5h 32m',
                status: 'online',
                performance: '95%'
            },
            users: {
                total: 24,
                active: 18,
                online: 12
            },
            agents: {
                total: 12,
                active: 10,
                performance: '98%'
            },
            relay: {
                emails_processed: 1234,
                spam_detected: 45,
                viruses_found: 2,
                status: 'operational'
            },
            security: {
                threats_detected: 0,
                firewall_status: 'active',
                last_scan: '2024-01-15 14:30:25'
            },
            services: this.getServicesStatus()
        };
    }
    
    getServicesStatus() {
        return [
            {
                name: 'FazAI Core',
                version: 'v2.0.0',
                status: 'online',
                uptime: '2d 5h 32m',
                port: 3120
            },
            {
                name: 'Worker Gemma',
                version: 'v1.0.0',
                status: 'online',
                uptime: '1d 12h 15m',
                port: 3121
            },
            {
                name: 'Relay SMTP',
                version: 'v1.0.0',
                status: 'online',
                uptime: '3d 8h 45m',
                port: 25
            },
            {
                name: 'Grafana',
                version: 'v9.5.0',
                status: 'online',
                uptime: '5d 2h 10m',
                port: 3000
            },
            {
                name: 'Prometheus',
                version: 'v2.45.0',
                status: 'online',
                uptime: '7d 1h 30m',
                port: 9090
            }
        ];
    }
    
    getLogs(level = 'all', service = 'all', limit = 100) {
        // Simular logs
        const logs = [
            {
                timestamp: '2024-01-15 14:30:25',
                level: 'INFO',
                service: 'FazAI',
                message: 'Sistema iniciado com sucesso'
            },
            {
                timestamp: '2024-01-15 14:29:15',
                level: 'INFO',
                service: 'Worker',
                message: 'Worker Gemma carregado'
            },
            {
                timestamp: '2024-01-15 14:28:45',
                level: 'INFO',
                service: 'Relay',
                message: 'Relay SMTP configurado'
            },
            {
                timestamp: '2024-01-15 14:27:30',
                level: 'WARNING',
                service: 'Security',
                message: 'Tentativa de login suspeita detectada'
            }
        ];
        
        return logs.slice(0, parseInt(limit));
    }
    
    broadcastToClients(message) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
    
    broadcastToAdmins(message) {
        this.adminClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
    
    start() {
        return new Promise((resolve, reject) => {
            try {
                // Iniciar servidor cliente
                this.server.listen(this.config.port, () => {
                    console.log(`🌐 DOCLER Cliente rodando em http://localhost:${this.config.port}`);
                });
                
                // Iniciar servidor admin
                this.adminServer.listen(this.config.adminPort, () => {
                    console.log(`🔧 DOCLER Admin rodando em http://localhost:${this.config.adminPort}`);
                });
                
                // Iniciar loop de atualizações
                this.startUpdateLoop();
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
    
    startUpdateLoop() {
        // Atualizar face DOCLER periodicamente
        setInterval(() => {
            this.broadcastToClients({
                type: 'face_update',
                mood: this.getRandomMood(),
                timestamp: new Date().toISOString()
            });
        }, 10000);
        
        // Atualizar dashboard periodicamente
        setInterval(() => {
            this.broadcastToAdmins({
                type: 'dashboard_update',
                data: this.getDashboardData()
            });
        }, 5000);
        
        // Atualizar status dos serviços
        setInterval(() => {
            this.broadcastToAdmins({
                type: 'services_update',
                data: this.getServicesStatus()
            });
        }, 15000);
    }
    
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Servidor DOCLER Cliente parado');
                });
            }
            
            if (this.adminServer) {
                this.adminServer.close(() => {
                    console.log('Servidor DOCLER Admin parado');
                });
            }
            
            if (this.wss) {
                this.wss.close();
            }
            
            if (this.adminWss) {
                this.adminWss.close();
            }
            
            resolve();
        });
    }
}

// Exportar classe
module.exports = DoclerWebServer;

// Executar se chamado diretamente
if (require.main === module) {
    const server = new DoclerWebServer({
        port: process.env.DOCLER_PORT || 3120,
        adminPort: process.env.DOCLER_ADMIN_PORT || 3121
    });
    
    server.start().then(() => {
        console.log('🚀 DOCLER Web Server iniciado com sucesso!');
        console.log('📱 Cliente: http://localhost:3120');
        console.log('🔧 Admin: http://localhost:3121');
    }).catch(error => {
        console.error('❌ Erro ao iniciar DOCLER Web Server:', error);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Parando DOCLER Web Server...');
        server.stop().then(() => {
            console.log('✅ DOCLER Web Server parado com sucesso');
            process.exit(0);
        });
    });
}
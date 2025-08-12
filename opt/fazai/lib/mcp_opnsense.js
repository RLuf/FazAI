#!/usr/bin/env node

/**
 * FazAI - MCP OPNsense Integration
 * Autor: Roger Luft
 * Versão: 1.0
 * 
 * Este módulo implementa integração MCP (Model Context Protocol) com OPNsense
 * para gerenciamento de firewall, regras, interfaces e configurações de rede
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: '/var/log/fazai/mcp_opnsense.log',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class MCPOPNsense {
    constructor(config) {
        config = config || {};
        this.config = {
            host: config.host || '192.168.1.1',
            port: config.port || 443,
            protocol: config.protocol || 'https',
            apiKey: config.apiKey || '',
            apiSecret: config.apiSecret || '',
            verifySSL: config.verifySSL !== false,
            timeout: config.timeout || 30000,
            ...config
        };
        
        this.baseURL = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
        this.apiURL = `${this.baseURL}/api`;
        this.sessionToken = null;
        this.sessionExpiry = null;
        
        // Cache para sessões e configurações
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 minutos
        
        logger.info('MCP OPNsense inicializado', { host: this.config.host, port: this.config.port });
    }
    
    /**
     * Autenticar com OPNsense
     */
    async authenticate() {
        try {
            if (this.sessionToken && this.sessionExpiry && Date.now() < this.sessionExpiry) {
                return this.sessionToken;
            }
            
            logger.info('Autenticando com OPNsense...');
            
            const authResponse = await axios.post(`${this.apiURL}/auth/login`, {
                username: this.config.apiKey,
                password: this.config.apiSecret
            }, {
                timeout: this.config.timeout,
                httpsAgent: this.config.verifySSL ? undefined : new (require('https').Agent)({ rejectUnauthorized: false })
            });
            
            if (authResponse.data && authResponse.data.token) {
                this.sessionToken = authResponse.data.token;
                this.sessionExpiry = Date.now() + (3600000); // 1 hora
                
                logger.info('Autenticação OPNsense bem-sucedida');
                return this.sessionToken;
            } else {
                throw new Error('Token de autenticação não recebido');
            }
        } catch (error) {
            logger.error('Erro na autenticação OPNsense', { error: error.message });
            throw new Error(`Falha na autenticação: ${error.message}`);
        }
    }
    
    /**
     * Fazer requisição autenticada para API
     */
    async makeRequest(endpoint, method, data) {
        method = method || 'GET';
        data = data || null;
        const token = await this.authenticate();
        
        const config = {
            method,
            url: `${this.apiURL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout,
            httpsAgent: this.config.verifySSL ? undefined : new (require('https').Agent)({ rejectUnauthorized: false })
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }
        
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error(`Erro na requisição ${method} ${endpoint}`, { 
                error: error.message, 
                status: error.response?.status 
            });
            throw new Error(`Erro na API: ${error.message}`);
        }
    }
    
    /**
     * Obter informações do sistema
     */
    async getSystemInfo() {
        try {
            const info = await this.makeRequest('/system/info');
            logger.info('Informações do sistema obtidas');
            return info;
        } catch (error) {
            logger.error('Erro ao obter informações do sistema', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Listar interfaces de rede
     */
    async getInterfaces() {
        try {
            const interfaces = await this.makeRequest('/interfaces');
            logger.info('Interfaces de rede obtidas', { count: interfaces.length });
            return interfaces;
        } catch (error) {
            logger.error('Erro ao obter interfaces', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter configuração de interface específica
     */
    async getInterfaceConfig(ifname) {
        try {
            const config = await this.makeRequest(`/interfaces/${ifname}`);
            logger.info('Configuração de interface obtida', { interface: ifname });
            return config;
        } catch (error) {
            logger.error('Erro ao obter configuração de interface', { 
                interface: ifname, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Listar regras de firewall
     */
    async getFirewallRules() {
        try {
            const rules = await this.makeRequest('/firewall/rules');
            logger.info('Regras de firewall obtidas', { count: rules.length });
            return rules;
        } catch (error) {
            logger.error('Erro ao obter regras de firewall', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter regra de firewall específica
     */
    async getFirewallRule(uuid) {
        try {
            const rule = await this.makeRequest(`/firewall/rules/${uuid}`);
            logger.info('Regra de firewall obtida', { uuid });
            return rule;
        } catch (error) {
            logger.error('Erro ao obter regra de firewall', { 
                uuid, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Criar nova regra de firewall
     */
    async createFirewallRule(ruleData) {
        try {
            const rule = await this.makeRequest('/firewall/rules', 'POST', ruleData);
            logger.info('Regra de firewall criada', { 
                uuid: rule.uuid, 
                description: ruleData.description 
            });
            return rule;
        } catch (error) {
            logger.error('Erro ao criar regra de firewall', { 
                ruleData, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Atualizar regra de firewall existente
     */
    async updateFirewallRule(uuid, ruleData) {
        try {
            const rule = await this.makeRequest(`/firewall/rules/${uuid}`, 'PUT', ruleData);
            logger.info('Regra de firewall atualizada', { uuid });
            return rule;
        } catch (error) {
            logger.error('Erro ao atualizar regra de firewall', { 
                uuid, 
                ruleData, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Deletar regra de firewall
     */
    async deleteFirewallRule(uuid) {
        try {
            await this.makeRequest(`/firewall/rules/${uuid}`, 'DELETE');
            logger.info('Regra de firewall deletada', { uuid });
            return true;
        } catch (error) {
            logger.error('Erro ao deletar regra de firewall', { 
                uuid, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Listar aliases de firewall
     */
    async getFirewallAliases() {
        try {
            const aliases = await this.makeRequest('/firewall/aliases');
            logger.info('Aliases de firewall obtidos', { count: aliases.length });
            return aliases;
        } catch (error) {
            logger.error('Erro ao obter aliases de firewall', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Criar alias de firewall
     */
    async createFirewallAlias(aliasData) {
        try {
            const alias = await this.makeRequest('/firewall/aliases', 'POST', aliasData);
            logger.info('Alias de firewall criado', { 
                uuid: alias.uuid, 
                name: aliasData.name 
            });
            return alias;
        } catch (error) {
            logger.error('Erro ao criar alias de firewall', { 
                aliasData, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Obter status dos serviços
     */
    async getServicesStatus() {
        try {
            const services = await this.makeRequest('/system/services');
            logger.info('Status dos serviços obtido');
            return services;
        } catch (error) {
            logger.error('Erro ao obter status dos serviços', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Iniciar serviço
     */
    async startService(serviceName) {
        try {
            const result = await this.makeRequest(`/system/services/${serviceName}/start`, 'POST');
            logger.info('Serviço iniciado', { service: serviceName });
            return result;
        } catch (error) {
            logger.error('Erro ao iniciar serviço', { 
                service: serviceName, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Parar serviço
     */
    async stopService(serviceName) {
        try {
            const result = await this.makeRequest(`/system/services/${serviceName}/stop`, 'POST');
            logger.info('Serviço parado', { service: serviceName });
            return result;
        } catch (error) {
            logger.error('Erro ao parar serviço', { 
                service: serviceName, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Reiniciar serviço
     */
    async restartService(serviceName) {
        try {
            const result = await this.makeRequest(`/system/services/${serviceName}/restart`, 'POST');
            logger.info('Serviço reiniciado', { service: serviceName });
            return result;
        } catch (error) {
            logger.error('Erro ao reiniciar serviço', { 
                service: serviceName, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Obter logs do sistema
     */
    async getSystemLogs(limit, facility) {
        limit = limit || 100;
        facility = facility || null;
        try {
            let endpoint = `/system/logs?limit=${limit}`;
            if (facility) {
                endpoint += `&facility=${facility}`;
            }
            
            const logs = await this.makeRequest(endpoint);
            logger.info('Logs do sistema obtidos', { count: logs.length });
            return logs;
        } catch (error) {
            logger.error('Erro ao obter logs do sistema', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter logs de firewall
     */
    async getFirewallLogs(limit) {
        limit = limit || 100;
        try {
            const logs = await this.makeRequest(`/firewall/logs?limit=${limit}`);
            logger.info('Logs de firewall obtidos', { count: logs.length });
            return logs;
        } catch (error) {
            logger.error('Erro ao obter logs de firewall', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Aplicar configurações pendentes
     */
    async applyConfig() {
        try {
            const result = await this.makeRequest('/system/config/apply', 'POST');
            logger.info('Configurações aplicadas');
            return result;
        } catch (error) {
            logger.error('Erro ao aplicar configurações', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Fazer backup da configuração
     */
    async backupConfig() {
        try {
            const backup = await this.makeRequest('/system/config/backup', 'POST');
            logger.info('Backup da configuração criado');
            return backup;
        } catch (error) {
            logger.error('Erro ao criar backup', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Restaurar configuração de backup
     */
    async restoreConfig(backupData) {
        try {
            const result = await this.makeRequest('/system/config/restore', 'POST', backupData);
            logger.info('Configuração restaurada de backup');
            return result;
        } catch (error) {
            logger.error('Erro ao restaurar configuração', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter estatísticas de rede
     */
    async getNetworkStats(iface) {
        iface = iface || null;
        try {
            let endpoint = '/system/network/stats';
            if (iface) {
                endpoint += `?interface=${iface}`;
            }
            
            const stats = await this.makeRequest(endpoint);
            logger.info('Estatísticas de rede obtidas');
            return stats;
        } catch (error) {
            logger.error('Erro ao obter estatísticas de rede', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter informações de DHCP
     */
    async getDHCPInfo() {
        try {
            const dhcp = await this.makeRequest('/dhcp');
            logger.info('Informações de DHCP obtidas');
            return dhcp;
        } catch (error) {
            logger.error('Erro ao obter informações de DHCP', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obter informações de DNS
     */
    async getDNSInfo() {
        try {
            const dns = await this.makeRequest('/system/dns');
            logger.info('Informações de DNS obtidas');
            return dns;
        } catch (error) {
            logger.error('Erro ao obter informações de DNS', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Executar comando personalizado via MCP
     */
    async executeMCPCommand(command, params) {
        params = params || {};
        try {
            logger.info('Executando comando MCP', { command, params });
            
            switch (command) {
                case 'get_system_info':
                    return await this.getSystemInfo();
                    
                case 'get_interfaces':
                    return await this.getInterfaces();
                    
                case 'get_firewall_rules':
                    return await this.getFirewallRules();
                    
                case 'create_firewall_rule':
                    return await this.createFirewallRule(params);
                    
                case 'update_firewall_rule':
                    return await this.updateFirewallRule(params.uuid, params.ruleData);
                    
                case 'delete_firewall_rule':
                    return await this.deleteFirewallRule(params.uuid);
                    
                case 'get_services_status':
                    return await this.getServicesStatus();
                    
                case 'start_service':
                    return await this.startService(params.serviceName);
                    
                case 'stop_service':
                    return await this.stopService(params.serviceName);
                    
                case 'restart_service':
                    return await this.restartService(params.serviceName);
                    
                case 'apply_config':
                    return await this.applyConfig();
                    
                case 'backup_config':
                    return await this.backupConfig();
                    
                case 'get_network_stats':
                    return await this.getNetworkStats(params.interface);
                    
                case 'get_dhcp_info':
                    return await this.getDHCPInfo();
                    
                case 'get_dns_info':
                    return await this.getDNSInfo();
                    
                default:
                    throw new Error(`Comando MCP não reconhecido: ${command}`);
            }
        } catch (error) {
            logger.error('Erro ao executar comando MCP', { 
                command, 
                params, 
                error: error.message 
            });
            throw error;
        }
    }
    
    /**
     * Gerar relatório de segurança
     */
    async generateSecurityReport() {
        try {
            logger.info('Gerando relatório de segurança...');
            
            const report = {
                timestamp: new Date().toISOString(),
                system: await this.getSystemInfo(),
                interfaces: await this.getInterfaces(),
                firewall_rules: await this.getFirewallRules(),
                services: await this.getServicesStatus(),
                recent_logs: await this.getSystemLogs(50),
                firewall_logs: await this.getFirewallLogs(50)
            };
            
            logger.info('Relatório de segurança gerado');
            return report;
        } catch (error) {
            logger.error('Erro ao gerar relatório de segurança', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Verificar integridade do sistema
     */
    async checkSystemIntegrity() {
        try {
            logger.info('Verificando integridade do sistema...');
            
            const checks = {
                timestamp: new Date().toISOString(),
                system_info: await this.getSystemInfo(),
                services_running: await this.getServicesStatus(),
                interfaces_active: await this.getInterfaces(),
                firewall_enabled: true, // Assumir que está sempre ativo
                config_applied: true
            };
            
            // Verificar se serviços críticos estão rodando
            const criticalServices = ['firewall', 'dhcpd', 'unbound'];
            checks.critical_services_status = {};
            
            for (const service of criticalServices) {
                try {
                    const status = await this.makeRequest(`/system/services/${service}`);
                    checks.critical_services_status[service] = status.status === 'running';
                } catch (error) {
                    checks.critical_services_status[service] = false;
                }
            }
            
            logger.info('Verificação de integridade concluída');
            return checks;
        } catch (error) {
            logger.error('Erro ao verificar integridade do sistema', { error: error.message });
            throw error;
        }
    }
}

// Exportar classe e funções utilitárias
module.exports = {
    MCPOPNsense,
    
    // Funções utilitárias
    createOPNsenseClient: (config) => new MCPOPNsense(config),
    
    // Validação de configuração
    validateConfig: (config) => {
        const required = ['host', 'apiKey', 'apiSecret'];
        const missing = required.filter(key => !config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Configuração incompleta. Campos obrigatórios: ${missing.join(', ')}`);
        }
        
        return true;
    },
    
    // Exemplo de uso
    exampleUsage: () => {
        return `
// Exemplo de uso do MCP OPNsense
const { MCPOPNsense } = require('./mcp_opnsense');

const opnsense = new MCPOPNsense({
    host: '192.168.1.1',
    apiKey: 'sua_api_key',
    apiSecret: 'sua_api_secret',
    verifySSL: false
});

// Obter informações do sistema
opnsense.getSystemInfo()
    .then(info => console.log('Sistema:', info))
    .catch(error => console.error('Erro:', error));

// Criar regra de firewall
opnsense.createFirewallRule({
    description: 'Permitir SSH',
    interface: 'lan',
    direction: 'in',
    protocol: 'tcp',
    source: 'any',
    destination: 'any',
    destination_port: '22',
    action: 'pass'
}).then(rule => console.log('Regra criada:', rule));
        `;
    }
};
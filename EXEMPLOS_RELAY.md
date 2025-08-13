# 🚀 Exemplos de Uso: FazAI + Relay SMTP

## 📋 Integração Completa

O FazAI agora está integrado com seu sistema de relay SMTP, oferecendo automação inteligente e monitoramento avançado.

## 🎯 Comandos Diretos do Relay

### **Análise de Configuração**
```bash
# Analisa configuração atual e gera recomendações
fazai relay analyze

# Exemplo de saída:
✓ Sucesso: Análise concluída
Configuração: {
  "filters": ["spf", "dkim", "blacklist"],
  "securityLevel": 2,
  "scoreThreshold": 5.0,
  "redisConfigured": true,
  "aiSpamEnabled": false
}
Recomendações:
  • Ativar filtro de IA para detecção avançada de spam
  • Aumentar nível de segurança para HIGH
```

### **Configuração Automática**
```bash
# Configura relay com segurança alta e IA ativada
fazai relay configure

# Exemplo de saída:
✓ Sucesso: Relay configurado com sucesso
Configuração: {
  "security_level": 3,
  "score_threshold": 5.0,
  "filters": {
    "ai_spam": {
      "enabled": true,
      "spam_threshold": 0.7
    }
  }
}
```

### **Monitoramento em Tempo Real**
```bash
# Monitora logs e detecta padrões
fazai relay monitor

# Exemplo de saída:
✓ Sucesso: Monitoramento ativo
Análise: {
  "spamAttacks": 15,
  "virusDetections": 2,
  "rejectedEmails": 45,
  "performanceIssues": 0,
  "errors": 1
}
Alertas:
  • HIGH: Detectado ataque de spam: 15 tentativas
```

### **Estatísticas do Sistema**
```bash
# Mostra estatísticas completas
fazai relay stats

# Exemplo de saída:
✓ Sucesso: Estatísticas obtidas
Estatísticas: {
  "uptime": "2 days, 5 hours",
  "messagesProcessed": 15420,
  "spamDetected": 1234,
  "virusesDetected": 23,
  "performance": {
    "messagesPerMinute": 12.5,
    "spamRate": 8.0,
    "avgProcessingTime": 0.8
  }
}
```

### **Integração com SpamExperts**
```bash
# Configura integração com SpamExperts
fazai relay spamexperts

# Exemplo de saída:
✓ Sucesso: Integração com SpamExperts configurada
Integração: {
  "whitelistSync": true,
  "blacklistSync": true,
  "statisticsSync": true,
  "quarantineSync": true
}
```

### **Integração com Zimbra**
```bash
# Configura integração com Zimbra
fazai relay zimbra

# Exemplo de saída:
✓ Sucesso: Integração com Zimbra configurada
Integração: {
  "userSync": true,
  "domainSync": true,
  "quarantineSync": true,
  "statisticsSync": true
}
```

### **Gerenciamento de Blacklist**
```bash
# Adiciona IP malicioso à blacklist
fazai relay blacklist 192.168.1.100

# Exemplo de saída:
✓ Sucesso: IP 192.168.1.100 adicionado à blacklist
```

### **Reinicialização do Sistema**
```bash
# Reinicia o relay com novas configurações
fazai relay restart

# Exemplo de saída:
✓ Sucesso: Relay reiniciado com sucesso
```

## 🤖 Agente Inteligente com Relay

### **Configuração Completa Automática**
```bash
# O agente analisa e configura tudo automaticamente
fazai agent "configurar sistema de relay SMTP com proteção máxima, integrar com SpamExperts e Zimbra, e configurar monitoramento inteligente"

# O agente vai:
# 1. Analisar configuração atual
# 2. Detectar vulnerabilidades
# 3. Configurar filtros avançados
# 4. Integrar com SpamExperts
# 5. Integrar com Zimbra
# 6. Configurar monitoramento
# 7. Testar configuração
```

### **Resposta Automática a Ataques**
```bash
# O agente monitora e responde automaticamente
fazai agent "detectar ataque de spam em massa e implementar contramedidas automáticas"

# O agente vai:
# 1. Analisar logs em tempo real
# 2. Detectar padrões de ataque
# 3. Aumentar nível de segurança
# 4. Adicionar IPs à blacklist
# 5. Notificar administradores
# 6. Implementar proteções adicionais
```

### **Otimização de Performance**
```bash
# O agente otimiza configurações para melhor performance
fazai agent "otimizar performance do relay SMTP e reduzir latência de processamento"

# O agente vai:
# 1. Analisar métricas de performance
# 2. Identificar gargalos
# 3. Ajustar configurações
# 4. Otimizar filtros
# 5. Configurar cache Redis
# 6. Testar melhorias
```

## 🔧 Exemplos de Configuração Avançada

### **Configuração para Ambiente de Produção**
```bash
# Configuração completa para produção
fazai agent "configurar relay SMTP para ambiente de produção com alta disponibilidade, backup automático de configurações, e monitoramento 24/7"

# Inclui:
# - Configuração de cluster
# - Backup automático
# - Monitoramento contínuo
# - Alertas inteligentes
# - Failover automático
```

### **Integração com Sistema de Logs**
```bash
# Integra com sistema de logs centralizado
fazai agent "integrar logs do relay com sistema centralizado de logs e configurar alertas baseados em padrões de segurança"

# Inclui:
# - Integração com ELK Stack
# - Alertas baseados em IA
# - Correlação de eventos
# - Dashboards personalizados
```

### **Configuração de Quarentena Inteligente**
```bash
# Configura sistema de quarentena avançado
fazai agent "configurar sistema de quarentena inteligente com análise automática de ameaças e liberação baseada em IA"

# Inclui:
# - Análise automática de ameaças
# - Liberação baseada em IA
# - Notificações inteligentes
# - Relatórios automáticos
```

## 📊 Monitoramento e Alertas

### **Dashboard em Tempo Real**
```bash
# Acessa dashboard web
curl http://localhost:3120/relay/stats

# Retorna JSON com estatísticas completas
{
  "ok": true,
  "stats": {
    "uptime": "3 days, 12 hours",
    "messagesProcessed": 45678,
    "spamDetected": 3456,
    "virusesDetected": 67,
    "performance": {
      "messagesPerMinute": 15.2,
      "spamRate": 7.6,
      "avgProcessingTime": 0.6
    }
  }
}
```

### **Alertas Inteligentes**
```bash
# Monitora alertas em tempo real
fazai relay monitor

# Detecta automaticamente:
# - Ataques de spam
# - Tentativas de DDoS
# - Vírus em anexos
# - Problemas de performance
# - Falhas de sistema
```

## 🛡️ Segurança Avançada

### **Proteção contra Ataques**
```bash
# Configura proteção máxima
fazai agent "implementar proteção máxima contra ataques de spam, phishing e malware com resposta automática"

# Inclui:
# - Detecção de phishing com IA
# - Análise comportamental
# - Resposta automática
# - Isolamento de ameaças
# - Relatórios de segurança
```

### **Auditoria Completa**
```bash
# Configura auditoria avançada
fazai agent "configurar sistema de auditoria completa com logs detalhados, análise forense e relatórios de compliance"

# Inclui:
# - Logs detalhados
# - Análise forense
# - Relatórios de compliance
# - Backup de evidências
# - Análise de tendências
```

## 🎯 Benefícios da Integração

### **Automação Inteligente**
- ✅ Configuração automática baseada em IA
- ✅ Detecção e resposta a ameaças
- ✅ Otimização contínua de performance
- ✅ Integração seamless com SpamExperts/Zimbra

### **Monitoramento Avançado**
- ✅ Análise em tempo real
- ✅ Alertas inteligentes
- ✅ Dashboards personalizados
- ✅ Relatórios automáticos

### **Segurança Robusta**
- ✅ Proteção multicamadas
- ✅ Resposta automática a ataques
- ✅ Auditoria completa
- ✅ Compliance automático

**🎉 Agora você tem um sistema de email enterprise completo e inteligente!**
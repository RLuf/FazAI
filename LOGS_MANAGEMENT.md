# FazAI - Gerenciamento de Logs v1.41.0

Este documento descreve as funcionalidades de gerenciamento de logs implementadas no FazAI.

## Funcionalidades Implementadas

### 1. Interface de Linha de Comando (CLI)

#### Visualizar Logs
```bash
# Exibe as últimas 10 entradas de log (padrão)
fazai logs

# Exibe as últimas 20 entradas de log
fazai logs 20
```

#### Limpar Logs
```bash
# Limpa o arquivo de log (cria backup automaticamente)
fazai limpar-logs
# ou
fazai clear-logs
```

### 2. Interface Web

A nova interface web do FazAI inclui um painel completo de gerenciamento de logs com as seguintes funcionalidades:

#### Acessar a Interface Web
```bash
# Abre a interface web no navegador padrão
fazai web
```

#### Funcionalidades da Interface Web
- **Ver Logs**: Visualiza as últimas entradas de log com formatação colorida
- **Limpar Logs**: Remove todos os logs com criação automática de backup
- **Download Logs**: Faz download do arquivo de log atual
- **Configuração**: Permite configurar URL da API e intervalo de atualização
- **Monitoramento em Tempo Real**: Status do daemon e atualizações automáticas

### 3. API REST

O daemon FazAI agora inclui endpoints específicos para gerenciamento de logs:

#### Endpoints Disponíveis

##### GET /logs
Retorna as últimas entradas de log
```bash
curl "http://localhost:3120/logs?lines=10"
```

##### POST /logs/clear
Limpa o arquivo de log (cria backup)
```bash
curl -X POST "http://localhost:3120/logs/clear"
```

##### GET /logs/download
Faz download do arquivo de log
```bash
curl "http://localhost:3120/logs/download" -o fazai-logs.log
```

##### GET /status
Verifica o status do daemon
```bash
curl "http://localhost:3120/status"
```

## Arquivos Criados/Modificados

### Novos Arquivos
- `/opt/fazai/tools/fazai_web_frontend.html` - Interface web completa
- `/opt/fazai/tools/fazai_web.sh` - Script para abrir a interface web
- `LOGS_MANAGEMENT.md` - Esta documentação

### Arquivos Modificados
- `/opt/fazai/lib/main.js` - Daemon principal com novos endpoints
- `bin/fazai` - CLI com novos comandos de gerenciamento de logs

## Recursos de Segurança

### Backup Automático
Quando os logs são limpos, um backup é criado automaticamente com timestamp:
```
/var/log/fazai/fazai.log.backup.1703123456789
```

### Validação de Entrada
- Validação do número de linhas para visualização
- Verificação de existência de arquivos
- Tratamento de erros robusto

## Interface Web - Recursos Avançados

### Dashboard Interativo
- **Painel de Comando**: Execute comandos FazAI diretamente
- **Gerenciamento de Logs**: Visualize, limpe e faça download de logs
- **Informações do Sistema**: Acesso rápido a dados do sistema
- **Visualização de Dados**: Gráficos interativos com Chart.js
- **Controle do Daemon**: Recarregar módulos e verificar status
- **Configuração**: Personalizar URL da API e intervalos

### Recursos Visuais
- Design responsivo para desktop e mobile
- Indicadores de status em tempo real
- Alertas e notificações
- Tema moderno com gradientes
- Logs formatados com cores por nível (ERROR, WARN, INFO, DEBUG)

### Monitoramento
- Verificação automática do status do daemon
- Atualizações periódicas configuráveis
- Indicadores visuais de conectividade

## Exemplos de Uso

### Cenário 1: Limpeza Rotineira de Logs
```bash
# Via CLI
fazai limpar-logs

# Via API
curl -X POST "http://localhost:3120/logs/clear"
```

### Cenário 2: Monitoramento via Interface Web
1. Execute `fazai web` para abrir a interface
2. Configure a URL da API se necessário
3. Use o painel de logs para visualizar e gerenciar
4. Configure atualizações automáticas

### Cenário 3: Integração com Scripts
```bash
#!/bin/bash
# Script de manutenção

echo "Fazendo backup dos logs..."
curl "http://localhost:3120/logs/download" -o "backup-$(date +%Y%m%d).log"

echo "Limpando logs antigos..."
curl -X POST "http://localhost:3120/logs/clear"

echo "Verificando status do daemon..."
curl "http://localhost:3120/status"
```

## Troubleshooting

### Problema: Interface web não abre
**Solução**: Verifique se o arquivo existe em `/opt/fazai/tools/fazai_web_frontend.html`

### Problema: Erro ao limpar logs
**Solução**: Verifique permissões do diretório `/var/log/fazai/`

### Problema: API não responde
**Solução**: Verifique se o daemon está rodando:
```bash
sudo systemctl status fazai
sudo systemctl start fazai
```

### Problema: Logs não aparecem na interface web
**Solução**: Verifique a URL da API nas configurações da interface web

## Próximos Passos

Funcionalidades planejadas para versões futuras:
- Rotação automática de logs
- Filtros avançados por nível e data
- Exportação em diferentes formatos (JSON, CSV)
- Alertas por email/webhook
- Compressão de logs antigos
- Dashboard de métricas de logs
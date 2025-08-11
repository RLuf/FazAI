#!/usr/bin/env bash

_fazai_completions()
{
    local cur prev opts base
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Comandos principais organizados por categoria
    local system_commands="ajuda help --help -d --debug versao version -v check-deps verificar-deps"
    local service_commands="start stop restart status reload"
    local log_commands="logs limpar-logs clear-logs web"
    local system_info_commands="kernel sistema memoria disco processos rede data uptime"
    local visualization_commands="html tui interactive"
    local config_commands="config cache cache-clear"
    local ai_commands="mcps"
    local flags="-q --question -s --stream -w --web -d --debug --help"
    
    # Ferramentas por categoria
    local monitoring_tools="net_qos_monitor ports_monitor snmp_monitor system_info"
    local security_tools="modsecurity_setup suricata_setup crowdsec_setup monit_setup"
    local cloud_tools="cloudflare spamexperts"
    local rag_ai_tools="rag_ingest qdrant_setup auto_tool"
    local management_tools="agent_supervisor fazai-config"
    local utility_tools="http_fetch web_search geoip_lookup blacklist_check weather alerts"
    local interface_tools="fazai_web fazai_html_v1 fazai_tui fazai-config-tui"
    
    # Comandos de rede e monitoramento
    local net_commands="snmp prometheus grafana qdrant agentes"

    # Todos os comandos disponíveis
    opts="$flags $system_commands $service_commands $log_commands $system_info_commands $visualization_commands $config_commands $ai_commands $net_commands $monitoring_tools $security_tools $cloud_tools $rag_ai_tools $management_tools $utility_tools $interface_tools"

    # Opções específicas para cada subcomando
    case "${prev}" in
        logs)
            # Sugere números para o comando logs
            COMPREPLY=( $(compgen -W "5 10 20 50 100" -- ${cur}) )
            return 0
            ;;
        html)
            # Sugere tipos de dados para visualização HTML
            COMPREPLY=( $(compgen -W "memoria disco processos rede sistema" -- ${cur}) )
            return 0
            ;;
        mcps)
            # Sugere tarefas comuns para MCPS
            COMPREPLY=( $(compgen -W "atualizar sistema instalar pacote configurar rede monitorar servicos backup dados" -- ${cur}) )
            return 0
            ;;
        config)
            # Sugere opções de configuração
            COMPREPLY=( $(compgen -W "show edit reset backup restore test" -- ${cur}) )
            return 0
            ;;
        cache)
            # Sugere opções de cache
            COMPREPLY=( $(compgen -W "clear status info" -- ${cur}) )
            return 0
            ;;
        modsecurity_setup)
            # Sugere servidores web para ModSecurity
            COMPREPLY=( $(compgen -W "nginx apache" -- ${cur}) )
            return 0
            ;;
        cloudflare)
            # Sugere operações Cloudflare
            COMPREPLY=( $(compgen -W "zones dns firewall" -- ${cur}) )
            return 0
            ;;
        rag_ingest)
            # Sugere tipos de documentos para RAG
            COMPREPLY=( $(compgen -W "pdf docx txt url" -- ${cur}) )
            return 0
            ;;
        auto_tool)
            # Sugere tipos de ferramentas para gerar
            COMPREPLY=( $(compgen -W "monitoring security network backup" -- ${cur}) )
            return 0
            ;;
        net_qos_monitor)
            # Sugere sub-redes comuns
            COMPREPLY=( $(compgen -W "192.168.1.0/24 192.168.0.0/24 10.0.0.0/24" -- ${cur}) )
            return 0
            ;;
        start|stop|restart|status)
            # Comandos de serviço não precisam de argumentos adicionais
            COMPREPLY=()
            return 0
            ;;
        kernel|sistema|memoria|disco|processos|rede|data|uptime)
            # Comandos de sistema não precisam de argumentos adicionais
            COMPREPLY=()
            return 0
            ;;
        web|tui|config|cache-clear|reload)
            # Comandos simples não precisam de argumentos adicionais
            COMPREPLY=()
            return 0
            ;;
        *)
            ;;
    esac

    # Se não houver subcomando específico, sugere os comandos principais
    if [[ ${cur} == * ]] ; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}

# Função para completar argumentos de comandos específicos
_fazai_html_completions()
{
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    if [[ "${prev}" == "html" ]]; then
        # Primeiro argumento: tipo de dados
        COMPREPLY=( $(compgen -W "memoria disco processos rede sistema" -- ${cur}) )
    elif [[ "${COMP_WORDS[1]}" == "html" && "${COMP_WORDS[2]}" != "" ]]; then
        # Segundo argumento: tipo de gráfico
        COMPREPLY=( $(compgen -W "bar line pie doughnut" -- ${cur}) )
    fi
}

# Função para completar comandos MCPS
_fazai_mcps_completions()
{
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    if [[ "${prev}" == "mcps" ]]; then
        # Sugere tarefas comuns para MCPS
        local mcps_tasks="atualizar sistema instalar pacote configurar rede monitorar servicos backup dados limpar logs verificar seguranca otimizar performance"
        COMPREPLY=( $(compgen -W "${mcps_tasks}" -- ${cur}) )
    fi
}

# Função para completar comandos de logs
_fazai_logs_completions()
{
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    if [[ "${prev}" == "logs" ]]; then
        # Sugere números comuns para visualização de logs
        COMPREPLY=( $(compgen -W "5 10 20 50 100 200 500" -- ${cur}) )
    fi
}

# Função principal de completion
_fazai_main_completion()
{
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Se é o primeiro argumento, usa a função principal
    if [[ ${COMP_CWORD} -eq 1 ]]; then
        _fazai_completions
    else
        # Para argumentos subsequentes, usa funções específicas
        case "${COMP_WORDS[1]}" in
            html)
                _fazai_html_completions
                ;;
            mcps)
                _fazai_mcps_completions
                ;;
            logs)
                _fazai_logs_completions
                ;;
            *)
                _fazai_completions
                ;;
        esac
    fi
}

# Registra a função de completion
complete -F _fazai_main_completion fazai

# Função para mostrar ajuda de completion
_fazai_show_completion_help()
{
    echo "FazAI Bash Completion v1.42.1"
    echo ""
    echo "Comandos disponíveis:"
    echo "  Sistema:     ajuda, help, --help, -d, --debug, versao, version, -v, check-deps"
    echo "  Serviço:     start, stop, restart, status, reload"
    echo "  Logs:        logs [n], limpar-logs, clear-logs, web"
    echo "  Sistema:     kernel, sistema, memoria, disco, processos, rede, data, uptime"
    echo "  Visualização: html <tipo> [graf], tui, interactive"
    echo "  Configuração: config, cache, cache-clear"
    echo "  IA:          mcps <tarefa>"
    echo ""
    echo "Exemplos:"
    echo "  fazai html memoria bar"
    echo "  fazai mcps atualizar sistema"
    echo "  fazai logs 20"
    echo "  fazai cache"
}

# Comando para mostrar ajuda de completion
if [[ "${1}" == "--completion-help" ]]; then
    _fazai_show_completion_help
fi

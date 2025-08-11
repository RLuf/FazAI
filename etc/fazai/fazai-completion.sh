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
    local net_commands="snmp prometheus grafana qdrant agentes"

    # Todos os comandos disponíveis
    opts="$flags $system_commands $service_commands $log_commands $system_info_commands $visualization_commands $config_commands $ai_commands $net_commands"

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

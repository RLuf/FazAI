#!/usr/bin/env bash

# FazAI Bash Completion (unificado)

_fazai_completions()
{
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Categorias principais
    local flags="-q --question -s --stream -w --web -d --debug --help --completion-help"
    local system_commands="ajuda help versao version -v manual check-deps verificar-deps query"
    local service_commands="start stop restart status reload telemetry telemetry-smoke"
    local log_commands="logs limpar-logs clear-logs web"
    local system_info_commands="kernel sistema memoria disco processos rede data uptime"
    local visualization_commands="html interactive tui complex"
    local config_commands="config cache cache-clear"
    local ai_commands="agent mcps"
    local relay_commands="relay docler"
    local opn_commands="opn nl"
    local net_commands="snmp prometheus grafana qdrant agentes"
    local tool_commands="system-check version-bump sync-changes sync-keys github-setup install-llamacpp"
    local security_commands="modsecurity suricata crowdsec spamexperts cloudflare monit"
    local monitoring_commands="net-qos-monitor snmp-monitor agent-supervisor"

    opts="$flags $system_commands $service_commands $log_commands $system_info_commands $visualization_commands $config_commands $ai_commands $relay_commands $opn_commands $net_commands $tool_commands $security_commands $monitoring_commands"

    # Subcomandos específicos
    case "${COMP_WORDS[1]}" in
        logs)
            COMPREPLY=( $(compgen -W "5 10 20 50 100 200 500" -- ${cur}) )
            return 0 ;;
        html)
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "memoria disco processos rede sistema" -- ${cur}) )
            else
                COMPREPLY=( $(compgen -W "bar line pie doughnut" -- ${cur}) )
            fi
            return 0 ;;
        mcps)
            COMPREPLY=( $(compgen -W "atualizar sistema instalar pacote configurar rede monitorar servicos backup dados limpar logs verificar seguranca otimizar performance" -- ${cur}) )
            return 0 ;;
        agent)
            COMPREPLY=() ; return 0 ;;
        telemetry)
            COMPREPLY=( $(compgen -W "--enable --disable" -- ${cur}) )
            return 0 ;;
        relay)
            COMPREPLY=( $(compgen -W "analyze configure monitor stats spamexperts zimbra blacklist restart" -- ${cur}) )
            return 0 ;;
        docler)
            COMPREPLY=( $(compgen -W "start stop status admin" -- ${cur}) )
            return 0 ;;
        opn)
            COMPREPLY=( $(compgen -W "add list health interfaces metrics firewall rules apply diagnostics states activity logs" -- ${cur}) )
            return 0 ;;
        config)
            COMPREPLY=( $(compgen -W "show edit reset backup restore test" -- ${cur}) )
            return 0 ;;
    esac

    # Primeiro argumento: lista tudo
    if [[ ${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}

complete -F _fazai_completions fazai

_fazai_show_completion_help()
{
    echo "FazAI Bash Completion v2.0.0"
    echo ""
    echo "Comandos:"
    echo "  Sistema:     ajuda, help, versao, -v, manual, check-deps"
    echo "  Serviço:     start, stop, restart, status, reload, telemetry, telemetry-smoke"
    echo "  Logs:        logs [n], limpar-logs, clear-logs, web"
    echo "  Sistema:     kernel, sistema, memoria, disco, processos, rede, data, uptime"
    echo "  Visual:      html <tipo> [graf], interactive, tui, complex"
    echo "  Config:      config, cache, cache-clear"
    echo "  IA:          agent <objetivo>, mcps <tarefa>, -q/--question, -s/--stream, -w/--web"
    echo "  Relay:       relay analyze|configure|monitor|stats|spamexperts|zimbra|blacklist|restart"
    echo "  DOCLER:      docler start|stop|status|admin (Interface Web DOCLER – não confundir com Docker)"
    echo "  Segurança:   modsecurity, suricata, crowdsec, spamexperts, cloudflare, monit"
    echo "  Monitoria:   net-qos-monitor, snmp-monitor, agent-supervisor"
    echo "  OPNsense:    opn add|list|health|interfaces|metrics|firewall|rules|apply|diagnostics|states|activity|logs"
    echo ""
    echo "Notas: [telemetry].enable_ingest / enable_metrics controlam /ingest e /metrics."
}

if [[ "${1}" == "--completion-help" ]]; then
    _fazai_show_completion_help
fi

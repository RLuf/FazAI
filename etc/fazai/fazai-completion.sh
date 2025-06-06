#!/usr/bin/env bash

_fazai_completions()
{
    local cur prev opts base
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Subcomandos principais
    opts="install uninstall status config help version"

    # Opções específicas para cada subcomando
    case "${prev}" in
        config)
            COMPREPLY=( $(compgen -W "show edit reset backup restore" -- ${cur}) )
            return 0
            ;;
        install)
            COMPREPLY=( $(compgen -W "--debug --force --no-deps" -- ${cur}) )
            return 0
            ;;
        uninstall)
            COMPREPLY=( $(compgen -W "--purge --keep-config" -- ${cur}) )
            return 0
            ;;
        status)
            COMPREPLY=( $(compgen -W "--json --verbose" -- ${cur}) )
            return 0
            ;;
        help)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
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

complete -F _fazai_completions fazai

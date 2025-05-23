#!/usr/bin/env node

/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
 */

/**
 * FazAI - Orquestrador Inteligente de Automação
 * Redirecionador para o arquivo principal
 * 
 * Este arquivo redireciona para a nova localização do daemon principal em /opt/fazai/lib/main.js
 */

console.log('Redirecionando para /opt/fazai/lib/main.js...');

// Carrega o arquivo principal da nova localização
require('/opt/fazai/lib/main.js');

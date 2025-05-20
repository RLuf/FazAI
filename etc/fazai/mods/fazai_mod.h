/**
 * FazAI - Header para Módulos Nativos
 * 
 * Este arquivo define a interface padrão para módulos nativos do FazAI.
 * Todos os módulos devem implementar estas funções para serem carregados
 * corretamente pelo daemon.
 */

#ifndef FAZAI_MOD_H
#define FAZAI_MOD_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Inicializa o módulo.
 * Esta função é chamada quando o módulo é carregado pelo daemon.
 * 
 * @return 0 em caso de sucesso, código de erro em caso de falha
 */
int fazai_mod_init();

/**
 * Executa um comando no módulo.
 * 
 * @param cmd Comando a ser executado
 * @param result Buffer para armazenar o resultado
 * @param result_len Tamanho do buffer de resultado
 * @return 0 em caso de sucesso, código de erro em caso de falha
 */
int fazai_mod_exec(const char* cmd, char* result, int result_len);

/**
 * Finaliza o módulo.
 * Esta função é chamada quando o módulo é descarregado pelo daemon.
 */
void fazai_mod_cleanup();

#ifdef __cplusplus
}
#endif

#endif /* FAZAI_MOD_H */

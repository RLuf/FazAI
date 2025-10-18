## TODO imediato (prioridades atuais)

1. Reavaliar fallback Context7  
   - Analisar `erro.log` e confirmar se o fallback automático está atrapalhando.  
   - Desacoplar do fluxo padrão e expor como flag/opção manual quando a instrução exigir pesquisa externa.

2. Caminhos relativos e carregamento de configuração  
   - Garantir que `fazai.conf` seja buscado de forma relativa ao diretório de trabalho ou via `FAZAI_CONFIG_PATH`.  
   - Opcional: exibir mensagem inicial indicando diretório atual/contexto para evitar confusões.

3. Tratamento de logs  
   - Implementar `--debug/--verbose` com diferentes níveis de log definidos no `.conf`.  
   - Registrar saída estruturada em `/var/log/fazai.log` (ou caminho configurável).

4. Revisar linguagem base com Enoc  
   - Confirmar permanência do orquestrador em TypeScript ou planejar módulo complementar em outra linguagem.

5. Criar instalador inteligente  
   - Protótipo `curl https://github.com/RLuf/FazAI/.../install.sh | bash`.  
   - Avaliar empacotamento (`npm install fazai` ou similar).

6. Integração de personalidades/coleções  
   - Validar collections `fazai_memory` e `fazai_kb` em Qdrant (docker) e Zilliz/Milvus.  
   - Mapear schema para soluções Linux e demais inferências.

7. Implantar deep-searcher + GPTCache  
   - Conectar ambos ao backend vetorial existente.  
   - Definir fluxo de atualização entre cache e collections.

8. Estudar integração FazAI ↔ gemma3-cpp  
   - Reaproveitar o código base antigo, evoluindo sobre o runner `gemma3-cpp` (llama.cpp).

9. Explorar front-end moderno + APIs/tools  
   - Revisar diretórios trazidos para `~/fazai` (`www`, `tools`, etc.) e planejar UI final + suporte a APIs.

10. Itens herdados  
   - Perguntar antes de instalar novos pacotes (usar `bun` se aprovado).  
   - Reavaliar funcionalidade “continue” para Claude.

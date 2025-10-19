## TODO imediato (prioridades atuais)

1. Caminhos relativos e carregamento de configuração ✅  
   - Garantir que `fazai.conf` seja buscado de forma relativa ao diretório de trabalho ou via `FAZAI_CONFIG_PATH`. *(Implementado: busca multi-path + fallback em ~/.config/fazai)*  
   - Opcional: exibir mensagem inicial indicando diretório atual/contexto para evitar confusões. *(avaliar necessidade)*

2. Tratamento de logs ✅  
   - Implementado `--debug/--verbose`, leitura de `LOG_LEVEL` no `.conf`/env e `--log-file`.  
   - Logs gravados em `/var/log/fazai.log` com fallback automático e saída estruturada.

3. Revisar linguagem base com Enoc  
   - Confirmar permanência do orquestrador em TypeScript ou planejar módulo complementar em outra linguagem.

4. Criar instalador inteligente ✅  
   - Script `scripts/install.sh` agora baixa o repositório se necessário, executa build e instala em `~/.local/share/fazai` com symlink em `~/.local/bin`.  
   - README/Quick-Start atualizados com `curl ... | bash`. (Empacotamento npm pode ser feito depois, se desejarmos).

5. Integração de personalidades/coleções  
   - Validar collections `fazai_memory` e `fazai_kb` em Qdrant (docker) e Zilliz/Milvus.  
   - Mapear schema para soluções Linux e demais inferências.

6. Implantar deep-searcher + GPTCache  
   - Conectar ambos ao backend vetorial existente.  
   - Definir fluxo de atualização entre cache e collections.

7. Estudar integração FazAI ↔ gemma3-cpp  
   - Reaproveitar o código base antigo, evoluindo sobre o runner `gemma3-cpp` (llama.cpp).

8. Explorar front-end moderno + APIs/tools  
   - Revisar diretórios trazidos para `~/fazai` (`www`, `tools`, etc.) e planejar UI final + suporte a APIs.

9. Itens herdados  
   - Perguntar antes de instalar novos pacotes (usar `bun` se aprovado).  
   - Reavaliar funcionalidade “continue” para Claude.

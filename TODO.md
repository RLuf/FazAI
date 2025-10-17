## TODO imediato

1. Revisar com Enoc a linguagem base do projeto  
   - Decidir se o orquestrador continua em TypeScript ou se abrimos espaço para outra linguagem.

2. Criar instalador inteligente  
   - Protótipo `curl https://github.com/RLuf/FazAI/.../install.sh | bash`.  
   - Avaliar empacotamento `npm install fazai`.

3. Integrar personalidades/coleções no vetor store  
   - Garantir collections `fazai_memory` e `fazai_kb` tanto em Qdrant (docker) quanto no Zilliz/Milvus.
   - Mapear schema adequado para soluções Linux e demais inferências.

4. Implantar deep-searcher + GPTCache  
   - Conectar `deep-searcher` e `GPTCache` aos mesmos vetores (Qdrant/Milvus).
   - Definir fluxo de atualização entre cache e collections.

5. Estudar integração FazAI ↔ gemma3-cpp  
   - Reaproveitar o código base antigo, mas evoluindo sobre o runner `gemma3-cpp` (llama.cpp).

6. Explorar front-end moderno + APIs/tools  
   - Ver diretórios copiados para `~/fazai` (`www`, `tools` etc.).  
  - Definir caminho para interface do usuário final com suporte a APIs.

7. Itens herdados  
   - Perguntar antes de instalar novos pacotes (usar `bun` se aprovado).  
   - Reavaliar funcionalidade “continue” para Claude.

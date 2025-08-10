# FazAI - Diferença de Módulos v1.41.0

No projeto FazAI existem dois lugares distintos onde aparece o diretório `mods`, cada um com um propósito diferente:

1. `/opt/fazai/mods`
   - Este caminho faz parte da **instalação de runtime**. São colocados aqui os **módulos nativos compilados** (.so, .c, .h) que o daemon carrega via FFI para executar ações de baixo nível no sistema (por exemplo, manipulação de processos, coleta de estatísticas, criação de usuários etc.).
   - Em `/opt/fazai/mods` encontram-se os módulos prontos para uso, compilados e disponíveis para o daemon em `/opt/fazai/lib/main.js`.
   - Exemplo de arquivos:
     - `system_mod.so` (biblioteca compilada)
     - `system_mod.c` e `fazai_mod.h` (fontes e cabeçalhos usados para compilar o módulo)

2. `/etc/fazai/mods`
   - Este caminho faz parte da **configuração do sistema**. São armazenados **modelos, exemplos ou fontes** de módulos que podem ser adaptados, personalizados e compilados pelo instalador ou pelo administrador.
   - Em `/etc/fazai/mods` ficam arquivos de referência e template, que permitem ao usuário criar novos módulos ou ajustar os existentes antes de copiá-los para `/opt/fazai/mods`.
   - Exemplo de arquivos:
     - `system_mod.c` e `fazai_mod.h` (versão de exemplo que serve de base para criar módulos personalizados)
     - Outros esboços de módulos nativos que o instalador pode sincronizar para `/opt` se necessário

Resumindo:
- O **`mods` em `/opt`** contém os **módulos compilados e ativos**, usados diretamente pelo daemon FazAI em produção.
- O **`mods` em `/etc`** contém os **arquivos de configuração, exemplos e fontes** que servem como base para criar ou manter módulos, antes de instalá-los ou compilá-los em `/opt`.

Essa separação segue a boa prática de manter arquivos de execução em `/opt` e arquivos de configuração ou templates em `/etc`, permitindo upgrades e customizações sem misturar código-fonte e binários de runtime.

Compatível com: Debian/Ubuntu, Fedora/RedHat/CentOS, WSL
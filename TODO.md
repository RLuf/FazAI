## Todo List

  Correções a serem aplicadas de imediato:

1. Aprimorar o instalador com checagem de versoes, dependencias, em caso de erro o instalador deve tentar outras abordagens, eventualmente um repositorio proprio algo assim.

2. O systemctl, foi notado discrepancias grotescas no init script (/etc/systemd/system/fazai.service), apos a instalação no "postinstall" deve haver uma dupla verificação no status do daemon, com coleta e analise de log tanto por journaling quanto pelas saidas de log geradas pelo instalados no startup inicial e em caso de erro, tratar formas alternativas de contorno.
(É cogitavel a utilizaçao de uma API que comunica com um ollama em um pequeno modelo na nuvem para rapido diagnostico ou inicialmente apenas registros por telemetria afim de iniciar uma base de bugtrack).

3. Seria interessante para facilitar a configuraçao
(/etc/fazai/fazai.conf), tanto na parte de ais, de plan, act, fallback, keys, etc.. uma interface TUI inicial, vindo evoluir futuramente para uma interface java.

4. Conferir a estrutura de forma que os devidos arquivos fiquem nos devidos diretorios /etc /opt/ /var

5. Ajustar a coleta de chaves do arquivo /root/.env automaticamente para popular as chaves no fazai.conf

6. Reanalisar e se for o caso corrigir o sistema de orquestração do fazai, importante ressaltar que ele deve utilizar ferramentas "TOOLS" (MCP), para tarfas expecificas afim de dinamizar o fluxo e agilizar o processo, provendo plena expecialização na tarefa.

7. O proprio fazai deve construir/escrever seus modulos e/ou plugins sempre que necessario for conforme o julgamento de necessidade operacional e metrica de disponibilidade. Importartante sempre verificar dependencias e bibliotecas para compilação e se necessario instalar elas, tambem deve-ser logado todo tipo de implementação nova, para que seja comitado no repositorio principal.

8. Melhorar a documentação, tanto do instalador quanto do sistema em si, com exemplos práticos e detalhados de uso.
#####


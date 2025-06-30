## Todo List

  Correções a serem aplicadas de imediato:

1. Aprimorar o instalador com checagem de versoes, dependencias, em caso de erro o instalador deve tentar outras abordagens, eventualmente um repositorio proprio algo assim.

2. O systemctl, foi notado discrepancias grotescas no init script (/etc/systemd/system/fazai.service), apos a instalação no "postinstall" deve haver uma dupla verificação no status do daemon, com coleta e analise de log tanto por journaling quanto pelas saidas de log geradas pelo instalados no startup inicial e em caso de erro, tratar formas alternativas de contorno.
(É cogitavel a utilizaçao de uma API que comunica com um ollama em um pequeno modelo na nuvem para rapido diagnostico ou inicialmente apenas registros por telemetria afim de iniciar uma base de bugtrack).

3. Seria interessante para facilitar a configuraçao
(/etc/fazai/fazai.conf), tanto na parte de ais, de plan, act, fallback, keys, etc.. uma interface TUI inicial, vindo evoluir futuramente para uma interface java. MANTER A PORTA PADRÃO DO DAEMON DO FAZAI EM 3120.

4. Conferir a estrutura de forma que os devidos arquivos fiquem nos devidos diretorios conforme conformidades e estrutura organizacional proposta.. ex.. /etc /opt/ /var etc... 

5. Ajustar a coleta de chaves do arquivo /root/.env automaticamente para popular as chaves no fazai.conf

6. Reanalisar e se for o caso corrigir o sistema de orquestração do fazai, importante ressaltar que ele deve utilizar ferramentas "TOOLS" (MCP), para tarfas expecificas afim de dinamizar o fluxo e agilizar o processo, provendo plena expecialização na tarefa.

7. O proprio fazai deve construir/escrever seus modulos e/ou plugins sempre que necessario for conforme o julgamento de necessidade operacional e metrica de disponibilidade. Importartante sempre verificar dependencias e bibliotecas para compilação e se necessario instalar elas, tambem deve-ser logado todo tipo de implementação nova, para que seja comitado no repositorio principal.

8. Melhorar a documentação, tanto do instalador quanto do sistema em si, com exemplos práticos e detalhados de uso.

9. Automatizar o processo de architetar e actions, para que o usuário possa facilmente criar e gerenciar suas próprias ações sem precisar editar arquivos manualmente. Ou seja abstrair a configuração de de planejar e executar ações, tornando o processo mais intuitivo e amigável. deixando apenas a opcao do usuario autorizar ou nao a execução de uma ação. e o sistema se encarrega de todo o resto.

10. Criar um modelo de container em docker debian para testar as releases do fazai, facilitando o processo de testes e validações antes de uma nova versão ser lançada.

11. Também verificar o processo de instalação do fazai, rodando unicamente o install.sh sem necessidade de rodar adicionais como scripts e npm para obter o fazai funcionando corretamente, garantindo que o usuário possa instalar o sistema de forma simples e rápida.
Confirmar que o script de instalação funcione corretamente em ambientes Linux e Windows via WSL, sem a necessidade de scripts adicionais ou npm, garantindo uma instalação limpa e funcional do FazAI. Em seguida conferir as instruções de download e instalação no README.md, garantindo que estejam atualizadas e corretas.

#12. Implementar um sistema de monitoramento e alerta para o fazai, que #notifique o usuário sobre falhas, problemas de desempenho ou qualquer #outra anomalia que possa ocorrer durante a operação do sistema. 

13. Criar um Dockerfile e/ou uma imagem Docker pronta contendo todas as dependências do FazAI, permitindo a execução do sistema em qualquer ambiente via container. O container deve:
    - Utilizar a porta oficial 3120 (range reservado: 3120-3125) para comunicação
    - Conter uma versão funcional do FazAI já instalada e configurada
    - Incluir todas as dependências necessárias para execução
    - Permitir persistência de dados e configurações via volumes
    - Ter documentação clara sobre build, uso e configuração
    - o USUARIO PODE OPTAR ENTRE INSTALAR FAZAI DOCKER (RECOMENDAR EM CASO DE IMCOMPATIBILIDADE COM O SISTEMA OPERACIONAL) OU INSTALAR DIRETAMENTE NO SISTEMA OPERACIONAL, ONDE O CLI SE COMUNICA DIRETAMENTE COM O DAEMON DO FAZAI. ATRAVEZ DO INSTALL_DOCKER.SH OU DO INSTALL.SH RESPECTIVAMENTE. CRIAR O INSTALL_DOCKER.SH
    - o usuario pode escolher em usar o fazai pronto dentro do docker onde apenas o cli se comunica com o container, ou instalar o fazai diretamente no sistema operacional, onde o cli se comunica diretamente com o daemon do fazai.
# FazAI - Guia de Agentes v1.41.0
- Sempre verifique a compatibilidade entre as versoes em relacao as versoes utilizadas seja do que for.
- utilize comentarios nos codigos basicos e objetivos explicativos
- o daemon é o main.js que fica adindo diretorio opt\fazai\lib\main.js
- o cliente fica fazai fica em bin
- todas alteracoes devem ser documentadas ao final no CHANGELOG.md segundo o modelo
- garanta que o instalador verifique todo ambiente, instale tudo que for necessario, verifique novamente caso houver erros procure alternativas, tornan
do o instalador o mais dinamico e aparentemente amigivel
- - nao priorize a seguranca nem acentuacao que possam vir a causar problemas neste primeiro momento
  - sempre faca testes de compatibilidade para garantir que nenhuma alteracao venha a conflitar com outra
  - use mecanismos inteligentes faça com que o instalador aprenda envie seus erros para roger@webstorage.com.br
  - o instalador e o sistema inicialmente devem iniciar utilizando o openrouter modelo deepseek/deepseek-r1-0528:free com a chave api key compativel com openai # Atualizada para a nova chave solicitada pelo usuário
  - em ultimo caso o instalador deve consultar a ai afim de conseguir achar uma metodo para instalar corretamente este pode ser um modulo compilado em C ou ateh mesmo python a ser chamado externamente, afim de mascarar as chave e tornar mais rapido o processo
  - revise e teste tudo sempre lembrando de documentar
- Compatível com: Debian/Ubuntu, Fedora/RedHat/CentOS, WSL 
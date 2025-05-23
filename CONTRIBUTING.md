# Contribuindo para o FazAI

Primeiramente, obrigado por considerar contribuir para o FazAI! É graças a pessoas como você que este projeto pode crescer e melhorar.

## Código de Conduta

Ao participar deste projeto, você concorda em manter um ambiente respeitoso e construtivo para todos. Esperamos que todos os contribuidores sigam estes princípios:

- Use linguagem acolhedora e inclusiva
- Respeite diferentes pontos de vista e experiências
- Aceite críticas construtivas com elegância
- Foque no que é melhor para a comunidade
- Demonstre empatia para com outros membros da comunidade

## Como posso contribuir?

### Reportando Bugs

Esta seção orienta você sobre como reportar bugs. Seguir estas diretrizes ajuda os mantenedores a entender seu relatório, reproduzir o comportamento e encontrar relatórios relacionados.

- Use o modelo de bug report fornecido ao criar uma issue
- Inclua o máximo de detalhes possível, incluindo passos para reproduzir, comportamento esperado e logs
- Descreva o ambiente em que o bug ocorre (SO, versão do Node.js, versão do FazAI)

### Sugerindo Melhorias

Esta seção orienta você sobre como sugerir melhorias. Seguir estas diretrizes ajuda os mantenedores a entender sua sugestão e tomar decisões informadas.

- Use o modelo de feature request fornecido ao criar uma issue
- Forneça uma descrição clara e detalhada da melhoria proposta
- Explique por que esta melhoria seria útil para a maioria dos usuários
- Liste possíveis implementações ou abordagens, se possível

### Pull Requests

- Preencha o modelo de pull request fornecido
- Atualize o CHANGELOG.md com detalhes das alterações
- Atualize a documentação conforme necessário
- O PR deve funcionar em todas as versões suportadas do Node.js
- Verifique se o código segue o estilo de codificação do projeto
- Inclua testes para novas funcionalidades ou correções de bugs

## Estilo de Codificação

- Use 2 espaços para indentação
- Use ponto e vírgula no final das declarações
- Limite as linhas a 100 caracteres
- Siga as convenções de nomenclatura existentes:
  - camelCase para variáveis e funções
  - PascalCase para classes
  - UPPER_CASE para constantes
- Documente funções e classes usando JSDoc
- Escreva comentários claros e úteis

## Processo de Desenvolvimento

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/amazing-feature`)
3. Faça suas alterações
4. Adicione testes para suas alterações
5. Execute os testes para garantir que tudo está funcionando
6. Commit suas alterações (`git commit -m 'Add some amazing feature'`)
7. Push para a branch (`git push origin feature/amazing-feature`)
8. Abra um Pull Request

## Estrutura do Projeto

```
/opt/fazai/           # Código e binários da aplicação
    /bin/             # Executáveis
    /lib/             # Bibliotecas principais (main.js)
    /tools/           # Ferramentas e plugins
    /mods/            # Módulos nativos (.so)
    /conf/            # Arquivos de configuração padrão

/etc/fazai/           # Configurações do sistema
    fazai.conf        # Arquivo de configuração principal

/var/log/fazai/       # Logs da aplicação
    fazai.log         # Arquivo de log principal

/var/lib/fazai/       # Dados persistentes
    /history/         # Histórico de conversas
    /cache/           # Cache de respostas
    /training/        # Dados para treinamento futuro
```

## Recursos Adicionais

- [Documentação do Projeto](https://github.com/rluf/fazai#readme)
- [Código de Conduta](CODE_OF_CONDUCT.md)
- [Licença](LICENSE)

## Dúvidas?

Se você tiver alguma dúvida sobre como contribuir, sinta-se à vontade para abrir uma issue com sua pergunta ou entrar em contato diretamente com os mantenedores.

Obrigado por suas contribuições!

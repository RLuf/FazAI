# 🐳 FazAI Container Manager TUI

Interface TUI interativa para gerenciar containers Docker com templates pré-definidos, especialmente otimizada para testes de desenvolvimento do FazAI.

## 🚀 Funcionalidades

### 📋 Templates Pré-definidos
- **Ubuntu 22.04 LTS**: Sistema limpo para testes gerais
- **FazAI Installer Test**: Container especializado para testar o instalador
- **Qdrant Vector Database**: Banco vetorial para RAG do FazAI
- **Nginx Development**: Servidor web para testes
- **Node.js 22 Development**: Ambiente Node.js para desenvolvimento

### 🔧 Operações de Container
- ✅ Listar containers existentes
- ✅ Criar containers a partir de templates
- ✅ Visualizar status e detalhes
- ✅ Limpar containers parados e imagens órfãs
- 🔄 Start/Stop/Restart containers (em desenvolvimento)
- 📄 Visualizar logs (em desenvolvimento)

## 📦 Instalação

O Container Manager TUI é instalado automaticamente com o FazAI. Para uso manual:

```bash
# Instalar dependência
pip install textual

# Tornar executável
chmod +x /opt/fazai/tools/container_manager_tui.py
```

## 🎯 Uso

### Via npm script (recomendado)
```bash
npm run containers-tui
```

### Via CLI wrapper
```bash
fazai-containers
```

### Execução direta
```bash
python3 /opt/fazai/tools/container_manager_tui.py
```

## 🖥️ Interface

### Abas Principais
1. **Containers**: Lista containers existentes com status
2. **Templates**: Mostra templates disponíveis 
3. **Images**: Lista imagens Docker locais
4. **Logs**: Visualização de logs (futuro)

### Controles
- **Tab**: Navegar entre abas
- **Enter**: Selecionar item/executar ação
- **Atalhos**: 
  - `q`: Sair
  - `r`: Atualizar dados
  - Botões: Atualizar, Criar Container, Limpar Tudo

## 🛠️ Templates Detalhados

### FazAI Installer Test
Template especializado para testar instalação do FazAI:

```yaml
Template: FazAI Installer Test
Imagem: ubuntu:22.04 (customizada)
Portas: 3120:3120
Volumes: /workspace (código fonte)
Variáveis:
  - FAZAI_PORT=3120
  - NODE_ENV=development
```

#### Uso do Template FazAI Installer Test

1. **Criar container pelo TUI**:
   - Selecione a aba "Templates"
   - Escolha "FazAI Installer Test"
   - Pressione Enter para criar

2. **Uso manual**:
```bash
# Criar e executar container
docker run -it --name fazai-test \
  -p 3120:3120 \
  -v $(pwd):/workspace \
  -e FAZAI_PORT=3120 \
  -e NODE_ENV=development \
  fazai-installer-test

# Dentro do container, testar instalação
cd /workspace
sudo ./install.sh

# Ou usar o script automatizado
docker-installer-test-entrypoint.sh auto
```

3. **Script de teste automatizado**:
O container inclui script para testes automatizados:
```bash
# Teste completo (instalação + desinstalação)
docker-installer-test-entrypoint.sh auto

# Apenas instalação
docker-installer-test-entrypoint.sh install

# Apenas desinstalação  
docker-installer-test-entrypoint.sh uninstall

# Modo interativo
docker-installer-test-entrypoint.sh interactive
```

## 📁 Arquivos Relacionados

- **TUI Principal**: `/opt/fazai/tools/container_manager_tui.py`
- **CLI Wrapper**: `/bin/fazai-containers`
- **Dockerfile Teste**: `/Dockerfile.installer-test`
- **Script Entrypoint**: `/docker-installer-test-entrypoint.sh`
- **Testes**: `/tests/container_manager.test.sh`

## 🔍 Desenvolvendo Templates

Para criar novos templates, edite `CONTAINER_TEMPLATES` em `container_manager_tui.py`:

```python
"meu-template": {
    "name": "Nome Descritivo",
    "image": "imagem:tag",
    "description": "Descrição do template",
    "command": "comando_inicial",
    "ports": ["porta_host:porta_container"], 
    "volumes": ["volume_host:volume_container"],
    "env_vars": {"VAR": "valor"},
    "interactive": True/False,
    "dockerfile_content": "..." # Opcional
}
```

### Campos Obrigatórios
- `name`: Nome exibido na interface
- `image`: Imagem Docker base
- `description`: Descrição do template
- `command`: Comando inicial do container
- `ports`: Lista de mapeamentos de porta
- `volumes`: Lista de volumes montados
- `env_vars`: Dicionário de variáveis de ambiente
- `interactive`: Se o container deve ser interativo

### Campos Opcionais
- `dockerfile_content`: Conteúdo de Dockerfile customizado

## 🧪 Testes

Execute os testes para verificar funcionalidade:

```bash
# Teste completo
bash tests/container_manager.test.sh

# Verificar apenas dependências
python3 -c "import textual; print('✓ Textual OK')"

# Testar funções básicas
python3 -c "
import sys
sys.path.append('/opt/fazai/tools')
import container_manager_tui
result = container_manager_tui.run_docker_command(['--version'])
print('✓ Docker OK' if result['success'] else '✗ Docker ERROR')
"
```

## 🐛 Solução de Problemas

### Erro: "Textual não instalado"
```bash
pip install textual
```

### Erro: "Docker não disponível"
Verifique se Docker está instalado e rodando:
```bash
docker --version
sudo systemctl start docker
```

### TUI não abre
Verifique se está executando em terminal que suporta TUI:
```bash
# Teste básico
python3 -c "import textual; print('Textual OK')"
```

### Permissões Docker
Adicione usuário ao grupo docker:
```bash
sudo usermod -aG docker $USER
# Relogar na sessão
```

## 🔄 Roadmap

### Versão Atual (v1.0)
- ✅ Interface TUI com navegação por abas
- ✅ Templates pré-definidos
- ✅ Criação de containers
- ✅ Limpeza automática
- ✅ Template especializado FazAI Installer Test

### Próximas Versões
- [ ] Operações de container (start/stop/restart/delete)
- [ ] Visualização de logs em tempo real
- [ ] Editor de templates via interface
- [ ] Importar/exportar configurações de templates
- [ ] Integração com docker-compose
- [ ] Suporte a networks customizadas
- [ ] Monitoramento de recursos (CPU/Memory)
- [ ] Notificações e alertas

## 📝 Contribuição

Para contribuir com o Container Manager:

1. Siga os padrões do FazAI (ver `AGENTS.md`)
2. Use `lower_snake_case` para nomes de arquivos
3. Mantenha logs estruturados (winston JSON)
4. Adicione testes para novas funcionalidades
5. Atualize documentação

## 📄 Licença

Mesmo licenciamento do FazAI - Creative Commons Attribution 4.0 International (CC BY 4.0).
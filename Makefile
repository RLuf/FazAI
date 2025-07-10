
# FazAI Makefile
# Autor: Roger Luft
# Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)

.PHONY: all clean build-standalone install dev-tools help

# Configurações
BUILD_DIR = build
DEV_DIR = dev

all: build-standalone

# Compila componentes standalone
build-standalone:
	@echo "Compilando componentes standalone..."
	@chmod +x $(DEV_DIR)/build-standalone.sh
	@$(DEV_DIR)/build-standalone.sh all

# Compila apenas deepseek_helper
deepseek:
	@echo "Compilando deepseek_helper..."
	@chmod +x $(DEV_DIR)/build-standalone.sh
	@$(DEV_DIR)/build-standalone.sh deepseek

# Instala ferramentas de desenvolvimento
dev-tools:
	@echo "Instalando ferramentas de desenvolvimento..."
	@chmod +x $(DEV_DIR)/install_dev_tools.sh
	@$(DEV_DIR)/install_dev_tools.sh

# Instala o FazAI completo
install:
	@echo "Instalando FazAI..."
	@chmod +x install.sh
	@./install.sh

# Limpa builds
clean:
	@echo "Limpando builds..."
	@chmod +x $(DEV_DIR)/build-standalone.sh
	@$(DEV_DIR)/build-standalone.sh clean

# Ajuda
help:
	@echo "FazAI Makefile - Comandos disponíveis:"
	@echo ""
	@echo "  make all              - Compila todos os componentes standalone"
	@echo "  make deepseek         - Compila apenas deepseek_helper"
	@echo "  make dev-tools        - Instala ferramentas de desenvolvimento"
	@echo "  make install          - Instala o FazAI completo"
	@echo "  make clean            - Limpa arquivos de build"
	@echo "  make help             - Mostra esta ajuda"
	@echo ""

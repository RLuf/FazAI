# Imagem base (Debian Slim para leveza e compatibilidade)
FROM debian:stable-slim

# Definir variáveis de ambiente
ENV FAZAI_PORT=3120 \
    NODE_ENV=production

# Instalar dependências do sistema e Node.js 22 a partir da NodeSource
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    git \
    systemd \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Criar diretórios necessários
RUN mkdir -p /opt/fazai /etc/fazai /var/log/fazai

# Copiar arquivos do FazAI
COPY bin/ /opt/fazai/bin/
COPY etc/fazai/ /etc/fazai/
RUN rm -f /etc/fazai/fazai.conf
COPY etc/fazai/fazai.conf.example /etc/fazai/
COPY package.json /opt/fazai/
COPY install.sh /opt/fazai/

WORKDIR /opt/fazai

# Instalar dependências Node.js
RUN npm install

# Configurar permissões
RUN chmod +x /opt/fazai/bin/fazai /opt/fazai/install.sh

# Expor a porta oficial do FazAI
# Range reservado: 3120-3125
EXPOSE 3120

# Volumes para persistência
VOLUME ["/etc/fazai", "/var/log/fazai"]

# Script de inicialização
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Comando de inicialização
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/opt/fazai/bin/fazai"]

# Imagem base (Debian Slim para leveza e compatibilidade)
FROM debian:stable-slim AS base

# Definir variáveis de ambiente
ENV FAZAI_PORT=3120 \
    NODE_ENV=production

# Instalar dependências do sistema e Node.js 22 a partir da NodeSource
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    git \
    ca-certificates \
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
COPY opt/fazai/lib/ /opt/fazai/lib/
COPY opt/fazai/tools/ /opt/fazai/tools/
COPY install.sh /opt/fazai/

# Preparar diretório do worker e modelos
RUN mkdir -p /opt/fazai/bin /opt/fazai/models/gemma /run/fazai

# Etapa de build do worker Gemma (C++)
FROM debian:stable-slim AS worker-build
RUN apt-get update && apt-get install -y cmake g++ make git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY worker/ /src/worker/
WORKDIR /src/worker
RUN mkdir -p build && cd build && cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai && cmake --build . -j$(nproc) && cmake --install .

# Imagem final: base + worker
FROM base AS final
COPY --from=worker-build /opt/fazai/bin/fazai-gemma-worker /opt/fazai/bin/fazai-gemma-worker
RUN chmod +x /opt/fazai/bin/fazai-gemma-worker && mkdir -p /run/fazai

WORKDIR /opt/fazai

# Instalar dependências Node.js
RUN npm install --omit=dev

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
CMD ["/usr/bin/node","/opt/fazai/lib/main.js"]

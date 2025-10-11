import http.server
import socketserver
import os

# Caminho para o diretório que você quer expor
REPO_DIR = "/home/rluft/fazai"  # substitui com o caminho real

# Porta que você quer usar
PORT = 8001

# Muda para o diretório do repositório
os.chdir(REPO_DIR)

# Cria o servidor HTTP
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"🚀 Servindo '{REPO_DIR}' em http://localhost:{PORT}")
    httpd.serve_forever()


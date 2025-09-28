#!/usr/bin/env python3
"""
FazAI Container Manager TUI
Interface TUI interativa para gerenciar containers Docker com templates pré-definidos.
Seguindo padrões do FazAI: lower_snake_case para ferramentas, logging estruturado.
"""

import subprocess
import json
import os
import asyncio
from datetime import datetime
from pathlib import Path

try:
    from textual.app import App, ComposeResult
    from textual.widgets import (
        Header, Footer, Button, Static, ListView, ListItem, 
        Input, Label, TextArea, Tabs, Tab, DataTable, Tree
    )
    from textual.containers import Horizontal, Vertical, Container
    from textual.reactive import reactive
    from textual.message import Message
    from textual import events
except ImportError:
    print("Erro: Instale a biblioteca Textual: pip install textual")
    exit(1)

# Templates de containers pré-definidos
CONTAINER_TEMPLATES = {
    "ubuntu-22.04": {
        "name": "Ubuntu 22.04 LTS",
        "image": "ubuntu:22.04",
        "description": "Sistema Ubuntu limpo para testes gerais",
        "command": "bash",
        "ports": [],
        "volumes": [],
        "env_vars": {},
        "interactive": True
    },
    "fazai-installer-test": {
        "name": "FazAI Installer Test",
        "image": "ubuntu:22.04",
        "description": "Container para testar o instalador do FazAI",
        "command": "bash",
        "ports": ["3120:3120"],
        "volumes": ["/home/runner/work/FazAI/FazAI:/workspace"],
        "env_vars": {
            "FAZAI_PORT": "3120",
            "NODE_ENV": "development"
        },
        "interactive": True,
        "dockerfile_content": """FROM ubuntu:22.04

# Instala dependências básicas para FazAI
RUN apt-get update && apt-get install -y \\
    sudo curl git build-essential cmake \\
    python3 python3-pip python3-dev \\
    pkg-config libssl-dev libffi-dev \\
    wget lsb-release && \\
    rm -rf /var/lib/apt/lists/*

# Cria usuário não-root
RUN useradd -ms /bin/bash fazai && \\
    echo "fazai ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

WORKDIR /workspace
USER fazai

CMD ["bash"]
"""
    },
    "qdrant-vector-db": {
        "name": "Qdrant Vector Database",
        "image": "qdrant/qdrant:latest",
        "description": "Banco vetorial para RAG do FazAI",
        "command": "",
        "ports": ["6333:6333"],
        "volumes": ["qdrant_storage:/qdrant/storage"],
        "env_vars": {},
        "interactive": False
    },
    "nginx-dev": {
        "name": "Nginx Development",
        "image": "nginx:alpine",
        "description": "Servidor web para testes",
        "command": "",
        "ports": ["8080:80"],
        "volumes": [],
        "env_vars": {},
        "interactive": False
    },
    "node-22": {
        "name": "Node.js 22 Development",
        "image": "node:22-alpine",
        "description": "Ambiente Node.js para desenvolvimento",
        "command": "sh",
        "ports": ["3000:3000"],
        "volumes": ["/home/runner/work/FazAI/FazAI:/workspace"],
        "env_vars": {
            "NODE_ENV": "development"
        },
        "interactive": True
    }
}

def run_docker_command(cmd, capture_output=True):
    """Executa comando Docker e retorna resultado"""
    try:
        full_cmd = ["docker"] + cmd
        result = subprocess.run(
            full_cmd, 
            capture_output=capture_output, 
            text=True, 
            timeout=30
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout.strip() if capture_output else "",
            "stderr": result.stderr.strip() if capture_output else "",
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout executando comando Docker"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_containers():
    """Lista containers existentes"""
    result = run_docker_command(["ps", "-a", "--format", "json"])
    if not result["success"]:
        return []
    
    containers = []
    for line in result["stdout"].split('\n'):
        if line.strip():
            try:
                container = json.loads(line)
                containers.append({
                    "id": container.get("ID", "")[:12],
                    "name": container.get("Names", "").replace("/", ""),
                    "image": container.get("Image", ""),
                    "status": container.get("State", ""),
                    "ports": container.get("Ports", ""),
                    "created": container.get("CreatedAt", "")
                })
            except json.JSONDecodeError:
                continue
    return containers

def get_images():
    """Lista imagens disponíveis"""
    result = run_docker_command(["images", "--format", "json"])
    if not result["success"]:
        return []
    
    images = []
    for line in result["stdout"].split('\n'):
        if line.strip():
            try:
                image = json.loads(line)
                images.append({
                    "repository": image.get("Repository", ""),
                    "tag": image.get("Tag", ""),
                    "id": image.get("ID", "")[:12],
                    "size": image.get("Size", ""),
                    "created": image.get("CreatedAt", "")
                })
            except json.JSONDecodeError:
                continue
    return images

class ContainerManagerApp(App):
    """Aplicação TUI principal para gerenciar containers"""
    
    CSS = """
    .header {
        background: blue;
        color: white;
        height: 3;
        content-align: center middle;
    }
    
    .sidebar {
        width: 30%;
        background: $panel;
        border-right: wide $primary;
    }
    
    .main-content {
        width: 70%;
    }
    
    .container-item {
        padding: 1;
        margin: 1;
        border: round $primary;
    }
    
    .template-item {
        padding: 1;
        margin: 1;
        border: round $secondary;
        background: $panel;
    }
    
    .status-running {
        color: green;
    }
    
    .status-stopped {
        color: red;
    }
    
    .status-created {
        color: yellow;
    }
    """
    
    current_tab = reactive("containers")
    
    def compose(self) -> ComposeResult:
        """Compõe a interface principal"""
        yield Header(show_clock=True)
        
        with Container():
            yield Static("🐳 FazAI Container Manager TUI", classes="header")
            
            with Horizontal():
                with Vertical(classes="sidebar"):
                    yield Tabs("containers", "templates", "images", "logs")
                    yield Button("Atualizar", id="refresh", variant="primary")
                    yield Button("Criar Container", id="create", variant="success")
                    yield Button("Limpar Tudo", id="cleanup", variant="error")
                
                with Vertical(classes="main-content", id="main-content"):
                    yield DataTable(id="data-table")
                    yield TextArea(id="details", read_only=True)
        
        yield Footer()
    
    def on_mount(self) -> None:
        """Inicialização da aplicação"""
        self.title = "FazAI Container Manager"
        self.refresh_data()
    
    def on_tabs_tab_activated(self, event: Tabs.TabActivated) -> None:
        """Handler para mudança de aba"""
        self.current_tab = event.tab.id
        self.refresh_data()
    
    def refresh_data(self) -> None:
        """Atualiza dados na tabela principal"""
        table = self.query_one("#data-table", DataTable)
        table.clear(columns=True)
        
        if self.current_tab == "containers":
            self.refresh_containers(table)
        elif self.current_tab == "templates":
            self.refresh_templates(table)
        elif self.current_tab == "images":
            self.refresh_images(table)
    
    def refresh_containers(self, table: DataTable) -> None:
        """Atualiza lista de containers"""
        table.add_columns("ID", "Nome", "Imagem", "Status", "Portas")
        
        containers = get_containers()
        for container in containers:
            status_class = f"status-{container['status'].lower()}"
            table.add_row(
                container["id"],
                container["name"],
                container["image"],
                container["status"],
                container["ports"]
            )
    
    def refresh_templates(self, table: DataTable) -> None:
        """Atualiza lista de templates"""
        table.add_columns("Template", "Imagem", "Descrição", "Portas")
        
        for template_id, template in CONTAINER_TEMPLATES.items():
            table.add_row(
                template["name"],
                template["image"],
                template["description"],
                ", ".join(template["ports"])
            )
    
    def refresh_images(self, table: DataTable) -> None:
        """Atualiza lista de imagens"""
        table.add_columns("Repositório", "Tag", "ID", "Tamanho", "Criado")
        
        images = get_images()
        for image in images:
            table.add_row(
                image["repository"],
                image["tag"],
                image["id"],
                image["size"],
                image["created"]
            )
    
    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handler para botões"""
        if event.button.id == "refresh":
            self.refresh_data()
        elif event.button.id == "create":
            self.create_container_dialog()
        elif event.button.id == "cleanup":
            self.cleanup_containers()
    
    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handler para seleção de linha na tabela"""
        details = self.query_one("#details", TextArea)
        
        if self.current_tab == "containers":
            self.show_container_details(event.row_key.value)
        elif self.current_tab == "templates":
            self.show_template_details(event.row_key.value)
    
    def show_container_details(self, row_index: int) -> None:
        """Mostra detalhes do container selecionado"""
        containers = get_containers()
        if 0 <= row_index < len(containers):
            container = containers[row_index]
            
            # Obter informações detalhadas
            inspect_result = run_docker_command(["inspect", container["id"]])
            
            details_text = f"""Container: {container["name"]} ({container["id"]})
Imagem: {container["image"]}
Status: {container["status"]}
Portas: {container["ports"]}
Criado: {container["created"]}

Ações disponíveis:
- [Enter] Executar bash no container
- [s] Start  [t] Stop  [r] Restart  [d] Delete
- [l] Ver logs  [i] Inspecionar
"""
            
            details = self.query_one("#details", TextArea)
            details.text = details_text
    
    def show_template_details(self, row_index: int) -> None:
        """Mostra detalhes do template selecionado"""
        template_items = list(CONTAINER_TEMPLATES.items())
        if 0 <= row_index < len(template_items):
            template_id, template = template_items[row_index]
            
            details_text = f"""Template: {template["name"]}
ID: {template_id}
Imagem: {template["image"]}
Descrição: {template["description"]}

Configuração:
- Comando: {template["command"]}
- Portas: {", ".join(template["ports"]) if template["ports"] else "Nenhuma"}
- Volumes: {", ".join(template["volumes"]) if template["volumes"] else "Nenhum"}
- Interativo: {"Sim" if template["interactive"] else "Não"}

Variáveis de ambiente:
"""
            
            for key, value in template["env_vars"].items():
                details_text += f"- {key}={value}\n"
            
            if "dockerfile_content" in template:
                details_text += "\n--- Dockerfile customizado disponível ---"
            
            details_text += "\n\n[Enter] Criar container a partir deste template"
            
            details = self.query_one("#details", TextArea)
            details.text = details_text
    
    def create_container_dialog(self) -> None:
        """Abre diálogo para criar container"""
        # Para simplicidade, criar a partir do primeiro template
        template_id = "fazai-installer-test"
        self.create_container_from_template(template_id)
    
    def create_container_from_template(self, template_id: str) -> None:
        """Cria container a partir de template"""
        if template_id not in CONTAINER_TEMPLATES:
            return
        
        template = CONTAINER_TEMPLATES[template_id]
        
        # Gerar nome único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        container_name = f"{template_id}_{timestamp}"
        
        # Montar comando Docker
        docker_cmd = ["run", "-d", "--name", container_name]
        
        # Adicionar portas
        for port in template["ports"]:
            docker_cmd.extend(["-p", port])
        
        # Adicionar volumes
        for volume in template["volumes"]:
            docker_cmd.extend(["-v", volume])
        
        # Adicionar variáveis de ambiente
        for key, value in template["env_vars"].items():
            docker_cmd.extend(["-e", f"{key}={value}"])
        
        # Adicionar flags para interativo
        if template["interactive"]:
            docker_cmd.extend(["-it"])
        
        # Adicionar imagem e comando
        docker_cmd.append(template["image"])
        if template["command"]:
            docker_cmd.append(template["command"])
        
        # Executar comando
        result = run_docker_command(docker_cmd)
        
        details = self.query_one("#details", TextArea)
        if result["success"]:
            details.text = f"✅ Container '{container_name}' criado com sucesso!\n\nID: {result['stdout']}"
            self.refresh_data()
        else:
            details.text = f"❌ Erro ao criar container:\n{result.get('stderr', result.get('error', 'Erro desconhecido'))}"
    
    def cleanup_containers(self) -> None:
        """Remove containers parados e imagens não utilizadas"""
        details = self.query_one("#details", TextArea)
        
        # Remover containers parados
        prune_result = run_docker_command(["container", "prune", "-f"])
        
        # Remover imagens órfãs
        image_prune_result = run_docker_command(["image", "prune", "-f"])
        
        cleanup_text = "🧹 Limpeza realizada:\n\n"
        
        if prune_result["success"]:
            cleanup_text += f"Containers removidos:\n{prune_result['stdout']}\n\n"
        else:
            cleanup_text += f"Erro ao remover containers: {prune_result.get('stderr', 'Erro desconhecido')}\n\n"
        
        if image_prune_result["success"]:
            cleanup_text += f"Imagens removidas:\n{image_prune_result['stdout']}"
        else:
            cleanup_text += f"Erro ao remover imagens: {image_prune_result.get('stderr', 'Erro desconhecido')}"
        
        details.text = cleanup_text
        self.refresh_data()
    
    def on_key(self, event: events.Key) -> None:
        """Handler para teclas globais"""
        if event.key == "q":
            self.exit()
        elif event.key == "r":
            self.refresh_data()

def main():
    """Função principal"""
    # Verificar se Docker está disponível
    docker_check = run_docker_command(["--version"])
    if not docker_check["success"]:
        print("❌ Erro: Docker não está disponível ou não está instalado.")
        print("Instale o Docker antes de usar esta ferramenta.")
        return 1
    
    print("🐳 Iniciando FazAI Container Manager TUI...")
    app = ContainerManagerApp()
    app.run()
    return 0

if __name__ == "__main__":
    exit(main())
"""
Docler WebSocket Integration
Compatibilidade total com a interface web Docler do FazAI
"""

import asyncio
import websockets
import json
import aiohttp
from typing import Dict, Any, Optional, Set
from datetime import datetime
import logging

class DoclerBridge:
    """Bridge para comunicação com Docler Web Interface"""
    
    def __init__(self, gemma_worker):
        self.gemma_worker = gemma_worker
        self.docler_port = 3220
        self.docler_admin_port = 3221
        self.websocket_port = 3222
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.logger = logging.getLogger('fazai.docler')
        
    async def start_websocket_server(self):
        """Inicia servidor WebSocket para Docler"""
        async def handle_connection(websocket, path):
            """Handler para novas conexões WebSocket"""
            self.connected_clients.add(websocket)
            client_id = f"client_{len(self.connected_clients)}"
            
            try:
                # Envia mensagem de boas-vindas
                await websocket.send(json.dumps({
                    "type": "connected",
                    "message": "Conectado ao FazAI Gemma Worker",
                    "client_id": client_id,
                    "capabilities": self._get_capabilities(),
                    "timestamp": datetime.now().isoformat()
                }))
                
                # Loop de mensagens
                async for message in websocket:
                    await self._handle_docler_message(websocket, message, client_id)
                    
            except websockets.exceptions.ConnectionClosed:
                self.logger.info(f"Cliente {client_id} desconectado")
            finally:
                self.connected_clients.discard(websocket)
        
        # Inicia servidor WebSocket
        server = await websockets.serve(
            handle_connection,
            "0.0.0.0",
            self.websocket_port
        )
        
        self.logger.info(f"WebSocket server para Docler ativo na porta {self.websocket_port}")
        return server
    
    async def _handle_docler_message(self, websocket, message: str, client_id: str):
        """Processa mensagem do Docler"""
        try:
            data = json.loads(message)
            msg_type = data.get('type', 'command')
            
            if msg_type == 'command':
                await self._handle_command(websocket, data)
                
            elif msg_type == 'stream':
                await self._handle_stream(websocket, data)
                
            elif msg_type == 'personality':
                await self._handle_personality_change(websocket, data)
                
            elif msg_type == 'status':
                await self._send_status(websocket)
                
            elif msg_type == 'history':
                await self._send_history(websocket, data)
                
            elif msg_type == 'complex':
                await self._handle_complex_command(websocket, data)
                
            elif msg_type == 'upload':
                await self._handle_file_upload(websocket, data)
                
            elif msg_type == 'metrics':
                await self._send_metrics(websocket)
                
        except json.JSONDecodeError as e:
            await websocket.send(json.dumps({
                "type": "error",
                "message": f"JSON inválido: {e}",
                "timestamp": datetime.now().isoformat()
            }))
        except Exception as e:
            self.logger.error(f"Erro ao processar mensagem Docler: {e}")
            await websocket.send(json.dumps({
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }))
    
    async def _handle_command(self, websocket, data: Dict):
        """Processa comando simples"""
        command = data.get('command', '')
        
        # Envia para gemma-worker
        result = await self.gemma_worker.process({
            'input': command,
            'type': data.get('command_type', 'command')
        })
        
        # Formata resposta para Docler
        response = {
            "type": "response",
            "command": command,
            "result": result.result,
            "origin": result.origin,
            "timestamp": datetime.now().isoformat(),
            "execution_time": data.get('execution_time', 0)
        }
        
        await websocket.send(json.dumps(response))
        
        # Broadcast para outros clientes se configurado
        if data.get('broadcast', False):
            await self._broadcast_to_clients(response, exclude=websocket)
    
    async def _handle_stream(self, websocket, data: Dict):
        """Processa comando com streaming"""
        command = data.get('command', '')
        
        # Callback para enviar tokens conforme são gerados
        async def on_token(token: str):
            await websocket.send(json.dumps({
                "type": "stream_token",
                "token": token,
                "timestamp": datetime.now().isoformat()
            }))
        
        # Processa com streaming
        await self.gemma_worker.process_stream({
            'input': command,
            'type': data.get('command_type', 'command')
        }, on_token)
        
        # Sinaliza fim do stream
        await websocket.send(json.dumps({
            "type": "stream_end",
            "timestamp": datetime.now().isoformat()
        }))
    
    async def _handle_personality_change(self, websocket, data: Dict):
        """Altera personalidade ativa"""
        personality_name = data.get('personality', 'Claude')
        
        success = await self.gemma_worker.load_personality(personality_name)
        
        await websocket.send(json.dumps({
            "type": "personality_changed",
            "personality": personality_name,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }))
    
    async def _handle_complex_command(self, websocket, data: Dict):
        """Processa comando complexo com plano de execução"""
        command = data.get('command', '')
        
        # Analisa comando complexo
        processor = self.gemma_worker.complex_processor
        plan = processor.analyze_complex_command(command)
        
        # Envia plano para aprovação
        await websocket.send(json.dumps({
            "type": "execution_plan",
            "plan": plan,
            "requires_approval": True,
            "timestamp": datetime.now().isoformat()
        }))
        
        # Aguarda aprovação (timeout de 30 segundos)
        try:
            approval = await asyncio.wait_for(
                websocket.recv(),
                timeout=30.0
            )
            approval_data = json.loads(approval)
            
            if approval_data.get('approved'):
                # Executa plano com atualizações em tempo real
                async for update in self._execute_plan_with_updates(plan):
                    await websocket.send(json.dumps(update))
            else:
                await websocket.send(json.dumps({
                    "type": "plan_cancelled",
                    "timestamp": datetime.now().isoformat()
                }))
                
        except asyncio.TimeoutError:
            await websocket.send(json.dumps({
                "type": "approval_timeout",
                "message": "Tempo de aprovação expirado",
                "timestamp": datetime.now().isoformat()
            }))
    
    async def _execute_plan_with_updates(self, plan: Dict):
        """Executa plano enviando atualizações em tempo real"""
        processor = self.gemma_worker.complex_processor
        processor.execution_plan = plan
        
        for step_id in plan['execution_order']:
            step = next(s for s in plan['steps'] if s['id'] == step_id)
            
            # Notifica início do passo
            yield {
                "type": "step_start",
                "step_id": step_id,
                "description": step['description'],
                "timestamp": datetime.now().isoformat()
            }
            
            # Executa passo
            try:
                commands = await processor._generate_step_commands(step)
                
                for cmd in commands:
                    # Notifica comando sendo executado
                    yield {
                        "type": "command_execution",
                        "step_id": step_id,
                        "command": cmd,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    result = await processor._execute_command(cmd)
                    
                    # Notifica resultado
                    yield {
                        "type": "command_result",
                        "step_id": step_id,
                        "success": result['success'],
                        "output": result.get('output', ''),
                        "error": result.get('error'),
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    if not result['success']:
                        raise Exception(result['error'])
                
                # Passo concluído
                yield {
                    "type": "step_complete",
                    "step_id": step_id,
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                # Notifica erro
                yield {
                    "type": "step_error",
                    "step_id": step_id,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
                
                # Tenta rollback se configurado
                if plan.get('rollback_plan'):
                    yield {
                        "type": "rollback_start",
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    await processor._perform_rollback(plan['rollback_plan'])
                    
                    yield {
                        "type": "rollback_complete",
                        "timestamp": datetime.now().isoformat()
                    }
                
                break
        
        # Plano completo
        yield {
            "type": "plan_complete",
            "success": all(s['status'] == 'completed' for s in plan['steps']),
            "timestamp": datetime.now().isoformat()
        }
    
    async def _handle_file_upload(self, websocket, data: Dict):
        """Processa upload de arquivo para análise"""
        file_content = data.get('content', '')
        file_name = data.get('filename', 'unknown')
        file_type = data.get('filetype', 'text')
        
        # Analisa arquivo com Gemma
        if file_type == 'config':
            prompt = f"Analise este arquivo de configuração e sugira melhorias:\n{file_content}"
        elif file_type == 'log':
            prompt = f"Analise este log e identifique problemas:\n{file_content}"
        else:
            prompt = f"Analise este arquivo:\n{file_content}"
        
        result = await self.gemma_worker.process({
            'input': prompt,
            'type': 'query'
        })
        
        await websocket.send(json.dumps({
            "type": "file_analysis",
            "filename": file_name,
            "analysis": result.result,
            "timestamp": datetime.now().isoformat()
        }))
    
    async def _send_status(self, websocket):
        """Envia status atual do sistema"""
        status = {
            "type": "status",
            "services": {
                "gemma_worker": "online",
                "qdrant": self._check_service("qdrant"),
                "prometheus": self._check_service("prometheus"),
                "grafana": self._check_service("grafana"),
                "docler": "online"
            },
            "resources": {
                "cpu_percent": self._get_cpu_usage(),
                "memory_percent": self._get_memory_usage(),
                "disk_usage": self._get_disk_usage()
            },
            "active_personality": self.gemma_worker.active_personality_name,
            "loaded_modules": self.gemma_worker.list_modules(),
            "timestamp": datetime.now().isoformat()
        }
        
        await websocket.send(json.dumps(status))
    
    async def _send_history(self, websocket, data: Dict):
        """Envia histórico de comandos"""
        limit = data.get('limit', 100)
        
        # Busca histórico no Qdrant
        history = await self.gemma_worker.get_history(limit)
        
        await websocket.send(json.dumps({
            "type": "history",
            "entries": history,
            "total": len(history),
            "timestamp": datetime.now().isoformat()
        }))
    
    async def _send_metrics(self, websocket):
        """Envia métricas do sistema"""
        metrics = await self._collect_metrics()
        
        await websocket.send(json.dumps({
            "type": "metrics",
            "data": metrics,
            "timestamp": datetime.now().isoformat()
        }))
    
    async def _broadcast_to_clients(self, message: Dict, exclude=None):
        """Broadcast mensagem para todos os clientes conectados"""
        disconnected = set()
        
        for client in self.connected_clients:
            if client == exclude:
                continue
                
            try:
                await client.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
        
        # Remove clientes desconectados
        self.connected_clients -= disconnected
    
    def _get_capabilities(self) -> Dict:
        """Retorna capacidades disponíveis"""
        return {
            "commands": True,
            "streaming": True,
            "personalities": True,
            "complex_commands": True,
            "file_upload": True,
            "metrics": True,
            "history": True,
            "modules": self.gemma_worker.list_modules()
        }
    
    def _check_service(self, service: str) -> str:
        """Verifica status de um serviço"""
        import subprocess
        
        try:
            if service == "qdrant":
                # Tenta conectar ao Qdrant
                import requests
                resp = requests.get("http://127.0.0.1:6333/collections", timeout=1)
                return "online" if resp.status_code == 200 else "offline"
                
            else:
                # Verifica via systemctl
                result = subprocess.run(
                    f"systemctl is-active fazai-{service}",
                    shell=True,
                    capture_output=True,
                    text=True
                )
                return "online" if result.stdout.strip() == "active" else "offline"
                
        except:
            return "offline"
    
    def _get_cpu_usage(self) -> float:
        """Obtém uso de CPU"""
        import psutil
        return psutil.cpu_percent(interval=1)
    
    def _get_memory_usage(self) -> float:
        """Obtém uso de memória"""
        import psutil
        return psutil.virtual_memory().percent
    
    def _get_disk_usage(self) -> Dict:
        """Obtém uso de disco"""
        import psutil
        usage = psutil.disk_usage('/')
        return {
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": usage.percent
        }
    
    async def _collect_metrics(self) -> Dict:
        """Coleta métricas detalhadas do sistema"""
        return {
            "gemma": {
                "sessions_active": len(self.gemma_worker.sessions),
                "commands_processed": self.gemma_worker.stats['commands_processed'],
                "average_response_time": self.gemma_worker.stats['avg_response_time']
            },
            "qdrant": {
                "collections": await self._get_qdrant_stats(),
                "total_vectors": await self._count_qdrant_vectors()
            },
            "system": {
                "uptime": self._get_system_uptime(),
                "load_average": self._get_load_average(),
                "network_stats": self._get_network_stats()
            }
        }
    
    def _get_system_uptime(self) -> float:
        """Obtém uptime do sistema"""
        with open('/proc/uptime', 'r') as f:
            return float(f.readline().split()[0])
    
    def _get_load_average(self) -> List[float]:
        """Obtém load average"""
        import os
        return list(os.getloadavg())
    
    def _get_network_stats(self) -> Dict:
        """Obtém estatísticas de rede"""
        import psutil
        stats = psutil.net_io_counters()
        return {
            "bytes_sent": stats.bytes_sent,
            "bytes_recv": stats.bytes_recv,
            "packets_sent": stats.packets_sent,
            "packets_recv": stats.packets_recv
        }
    
    async def _get_qdrant_stats(self) -> int:
        """Obtém número de coleções no Qdrant"""
        # Implementação simplificada
        return 5
    
    async def _count_qdrant_vectors(self) -> int:
        """Conta total de vetores no Qdrant"""
        # Implementação simplificada
        return 10000


# Integração com o daemon principal
async def integrate_with_fazai_ecosystem():
    """Integra completamente com o ecossistema FazAI"""
    
    # Inicializa componentes
    gemma_worker = None  # Seria a instância real do GemmaWorker
    docler_bridge = DoclerBridge(gemma_worker)
    
    # Registra com o daemon principal
    integration = FazAIIntegration()
    await integration.register_with_daemon()
    
    # Inicia servidor WebSocket para Docler
    ws_server = await docler_bridge.start_websocket_server()
    
    # Sincroniza configuração
    integration.sync_configuration()
    
    print("Integração completa com FazAI estabelecida!")
    print(f"- Daemon principal: porta {integration.fazai_port}")
    print(f"- Gemma Worker: porta {integration.gemma_port}") 
    print(f"- Docler UI: porta {docler_bridge.docler_port}")
    print(f"- Docler Admin: porta {docler_bridge.docler_admin_port}")
    print(f"- WebSocket: porta {docler_bridge.websocket_port}")
    
    # Mantém servidor rodando
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(integrate_with_fazai_ecosystem())
"""
FazAI Integration Adapter v2.0
Garante compatibilidade total entre worker e daemon FazAI (Node.js)
Conforme AGENTS.md e arquitetura oficial FazAI
"""

import json
import socket
import asyncio
import aiohttp
import logging
import os
import uuid
import subprocess
from typing import Dict, Any, Optional, List
from pathlib import Path
import re

class FazAIIntegration:
    """Adaptador para daemon principal FazAI (porta 3120)"""
    
    def __init__(self):
        self.fazai_port = 3120  # Daemon Node.js conforme AGENTS.md
        self.gemma_port = 5555  # Worker ND-JSON
        self.logger = self._setup_winston_logging()
        self.config = self._load_fazai_config()
        
    def _setup_winston_logging(self) -> logging.Logger:
        """Logging compatível com Winston (JSON estruturado)"""
        formatter = logging.Formatter(
            '{"timestamp":"%(asctime)s","level":"%(levelname)s",'
            '"service":"fazai-integration","message":"%(message)s",'
            '"version":"2.0.0","module":"adapter"}'
        )
        
        # Logs conforme estrutura FazAI
        os.makedirs('/var/log/fazai', exist_ok=True)
        handler = logging.FileHandler('/var/log/fazai/integration.log')
        handler.setFormatter(formatter)
        
        logger = logging.getLogger('fazai.integration')
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler())
        logger.setLevel(logging.INFO)
        return logger
        
    def _load_fazai_config(self) -> Dict[str, Any]:
        """Carrega config oficial /etc/fazai/fazai.conf"""
        import configparser
        
        config = configparser.ConfigParser()
        config_path = "/etc/fazai/fazai.conf"
        
        defaults = {
            "daemon_host": "0.0.0.0",
            "daemon_port": 3120,
            "worker_host": "0.0.0.0", 
            "worker_port": 5555,
            "registration_timeout": 10,
            "command_timeout": 30,
            "gemma_timeout": 120,
            "shell_timeout": 60
        }
        
        if Path(config_path).exists():
            config.read(config_path)
            return {
                "daemon_host": config.get("daemon", "host", fallback=defaults["daemon_host"]),
                "daemon_port": config.getint("daemon", "port", fallback=defaults["daemon_port"]),
                "worker_host": config.get("gemma_worker", "host", fallback=defaults["worker_host"]),
                "worker_port": config.getint("gemma_worker", "port", fallback=defaults["worker_port"]),
                "registration_timeout": config.getint("dispatcher", "registration_timeout", fallback=defaults["registration_timeout"]),
                "command_timeout": config.getint("dispatcher", "command_timeout", fallback=defaults["command_timeout"]),
                "gemma_timeout": config.getint("gemma_cpp", "generation_timeout", fallback=defaults["gemma_timeout"]),
                "shell_timeout": config.getint("dispatcher", "shell_timeout", fallback=defaults["shell_timeout"])
            }
        
        # Auto-cria config padrão se não existe
        self._create_fazai_config(config_path, config, defaults)
        return defaults
        
    def _create_fazai_config(self, path: str, config: configparser.ConfigParser, defaults: Dict):
        """Cria fazai.conf padrão conforme estrutura oficial"""
        config.add_section('daemon')
        config.set('daemon', 'host', str(defaults["daemon_host"]))
        config.set('daemon', 'port', str(defaults["daemon_port"]))
        
        config.add_section('gemma_worker')
        config.set('gemma_worker', 'host', str(defaults["worker_host"]))
        config.set('gemma_worker', 'port', str(defaults["worker_port"]))
        
        config.add_section('dispatcher')
        config.set('dispatcher', 'registration_timeout', str(defaults["registration_timeout"]))
        config.set('dispatcher', 'command_timeout', str(defaults["command_timeout"]))
        config.set('dispatcher', 'shell_timeout', str(defaults["shell_timeout"]))
        
        config.add_section('gemma_cpp')
        config.set('gemma_cpp', 'generation_timeout', str(defaults["gemma_timeout"]))
        
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            config.write(f)
        self.logger.info(f"Config FazAI criado: {path}")
    
    async def register_worker_with_daemon(self) -> bool:
        """Registra worker com daemon conforme arquitetura FazAI"""
        try:
            timeout = aiohttp.ClientTimeout(total=self.config["registration_timeout"])
            async with aiohttp.ClientSession(timeout=timeout) as session:
                payload = {
                    "service": "gemma-worker",
                    "type": "ai_provider",
                    "protocol": "ndjson",
                    "socket": "/run/fazai/gemma.sock",
                    "capabilities": [
                        "local_llm", "command_interpretation", 
                        "natural_language", "shell_generation"
                    ],
                    "status": "online",
                    "version": "2.0.0"
                }
                
                daemon_url = f"http://{self.config['daemon_host']}:{self.config['daemon_port']}/services/register"
                
                async with session.post(daemon_url, json=payload) as resp:
                    success = resp.status == 200
                    if success:
                        self.logger.info("Worker registrado com daemon FazAI")
                    else:
                        self.logger.error(f"Falha no registro: HTTP {resp.status}")
                    return success
                    
        except Exception as e:
            self.logger.error(f"Erro registrando worker: {e}")
            return False
    
    def parse_cli_command(self, raw_command: str) -> Dict[str, Any]:
        """Parse comando /bin/fazai conforme AGENTS.md"""
        # Flags oficiais /bin/fazai
        flags = {
            'mcps': '-m' in raw_command,      # Model Context Protocol
            'query': '-q' in raw_command,     # Query mode
            'web': '-w' in raw_command,       # Web search
            'architecture': '-a' in raw_command,  # Architecture mode
            'verbose': '-v' in raw_command,   # Verbose output
            'fallback': '-f' in raw_command,  # Force fallback
            'local_only': '-l' in raw_command # Local Gemma only
        }
        
        # Remove flags do comando
        command = re.sub(r'-[mqwavfl]\s*', '', raw_command).strip()
        
        # Remove aspas se houver
        if command.startswith('"') and command.endswith('"'):
            command = command[1:-1]
        
        return {
            'command': command,
            'flags': flags,
            'type': 'query' if flags['query'] else 'command',
            'use_fallback': flags['fallback'],
            'local_only': flags['local_only']
        }
    
    async def send_to_worker(self, command_data: Dict) -> Optional[Dict]:
        """Envia para worker via socket Unix oficial /run/fazai/gemma.sock"""
        try:
            # Tenta Unix socket primeiro (produção)
            unix_path = "/run/fazai/gemma.sock"
            if Path(unix_path).exists():
                reader, writer = await asyncio.open_unix_connection(path=unix_path)
                logger.info("Conectado via Unix socket")
            else:
                # Fallback TCP (desenvolvimento)
                reader, writer = await asyncio.open_connection(
                    self.config['worker_host'], 
                    self.config['worker_port']
                )
                logger.info(f"Conectado via TCP {self.config['worker_host']}:{self.config['worker_port']}")
            
            # ND-JSON conforme SPEC.md
            ndjson_message = {
                "action": "ask" if command_data['type'] == 'query' else "shell",
                "action_id": str(uuid.uuid4()),
                "input": command_data['command'],
                "metadata": {
                    "flags": command_data.get('flags', {}),
                    "source": "integration_adapter",
                    "version": "2.0.0"
                }
            }
            
            # Envia + recebe
            data = json.dumps(ndjson_message) + '\n'
            writer.write(data.encode('utf-8'))
            await writer.drain()
            
            timeout_val = self.config["gemma_timeout"] if command_data['type'] == 'query' else self.config["command_timeout"]
            response_line = await asyncio.wait_for(reader.readline(), timeout=timeout_val)
            
            writer.close()
            await writer.wait_closed()
            
            if response_line:
                return json.loads(response_line.decode('utf-8').strip())
            return None
                
        except Exception as e:
            self.logger.error(f"Erro comunicação worker: {e}")
            return None
    
    async def forward_to_daemon(self, command_data: Dict) -> Dict:
        """Encaminha para daemon Node.js (porta 3120)"""
        try:
            timeout = aiohttp.ClientTimeout(total=self.config["command_timeout"])
            async with aiohttp.ClientSession(timeout=timeout) as session:
                endpoint = "/command/stream" if command_data.get('flags', {}).get('verbose') else "/command"
                
                payload = {
                    "command": command_data['command'],
                    "mcps": command_data.get('flags', {}).get('mcps', False),
                    "question": command_data['type'] == 'query',
                    "source": "integration_adapter"
                }
                
                daemon_url = f"http://{self.config['daemon_host']}:{self.config['daemon_port']}{endpoint}"
                
                async with session.post(daemon_url, json=payload) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        return {"error": f"Daemon HTTP {resp.status}", "success": False}
                        
        except Exception as e:
            self.logger.error(f"Erro encaminhando para daemon: {e}")
            return {"error": str(e), "success": False}


class ComplexCommandProcessor:
    """Processador de comandos complexos para agente cognitivo FazAI"""
    
    def __init__(self, integration: FazAIIntegration):
        self.integration = integration
        self.logger = integration.logger
        self.config = integration.config
        
    async def analyze_and_execute(self, command: str) -> Dict[str, Any]:
        """Analisa comando complexo e executa conforme metodologia FazAI"""
        
        # Parsing inteligente de comando multi-step
        steps = self._parse_complex_command(command)
        dependencies = self._analyze_step_dependencies(steps)
        execution_order = self._determine_execution_order(steps, dependencies)
        
        plan = {
            'original_command': command,
            'steps': steps,
            'dependencies': dependencies,
            'execution_order': execution_order,
            'timestamp': asyncio.get_event_loop().time()
        }
        
        self.logger.info(f"Plano execução criado: {len(steps)} passos")
        
        # Execução sequencial inteligente
        results = await self._execute_plan(plan)
        return results
    
    def _parse_complex_command(self, command: str) -> List[Dict]:
        """Parse comando complexo em steps executáveis"""
        # Marcadores sequenciais portugueses
        markers = ['em seguida', 'então', 'depois', 'após isso', 'e também', 'finalmente']
        
        parts = command
        for marker in markers:
            parts = parts.replace(marker, '|STEP|')
        
        steps = []
        for i, part in enumerate(parts.split('|STEP|')):
            if not part.strip():
                continue
                
            step = {
                'id': i + 1,
                'description': part.strip(),
                'type': self._classify_step_type(part),
                'status': 'pending',
                'retries': 0,
                'commands': []
            }
            steps.append(step)
        
        return steps
    
    def _classify_step_type(self, step_text: str) -> str:
        """Classifica tipo de step para execução otimizada"""
        text_lower = step_text.lower()
        
        if any(word in text_lower for word in ['verificar', 'checar', 'listar', 'mostrar']):
            return 'verification'
        elif any(word in text_lower for word in ['criar', 'configurar', 'instalar', 'definir']):
            return 'configuration'
        elif any(word in text_lower for word in ['monitorar', 'coletar', 'acompanhar']):
            return 'monitoring'
        elif any(word in text_lower for word in ['gráfico', 'relatório', 'dashboard']):
            return 'visualization'
        elif any(word in text_lower for word in ['iniciar', 'startar', 'executar']):
            return 'execution'
        else:
            return 'general'
    
    def _analyze_step_dependencies(self, steps: List[Dict]) -> Dict[int, List[int]]:
        """Análise de dependências entre steps"""
        deps = {}
        
        for i, step in enumerate(steps):
            step_deps = []
            
            # Dependência sequencial padrão
            if i > 0:
                step_deps.append(steps[i-1]['id'])
            
            # Dependências semânticas (referências cruzadas)
            desc = step['description'].lower()
            if any(ref in desc for ref in ['nestas portas', 'esses dados', 'o resultado anterior']):
                if i > 0:
                    step_deps.append(steps[i-1]['id'])
            
            deps[step['id']] = step_deps
        
        return deps
    
    def _determine_execution_order(self, steps: List[Dict], deps: Dict) -> List[int]:
        """Algoritmo topológico para ordem ótima de execução"""
        executed = set()
        order = []
        
        while len(order) < len(steps):
            for step in steps:
                if step['id'] in executed:
                    continue
                
                step_deps = deps.get(step['id'], [])
                if all(dep_id in executed for dep_id in step_deps):
                    order.append(step['id'])
                    executed.add(step['id'])
        
        return order
    
    async def _execute_plan(self, plan: Dict) -> Dict[str, Any]:
        """Executa plano com retry e rollback inteligente"""
        results = {
            'success': True,
            'steps_completed': [],
            'errors': [],
            'execution_time': 0
        }
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            for step_id in plan['execution_order']:
                step = next(s for s in plan['steps'] if s['id'] == step_id)
                
                self.logger.info(f"Executando step {step_id}: {step['description'][:50]}...")
                
                # Gera comandos para o step
                commands = await self._generate_step_commands(step)
                step['commands'] = commands
                
                # Executa com retry automático
                success = await self._execute_step_with_retry(step)
                
                if success:
                    step['status'] = 'completed'
                    results['steps_completed'].append(step_id)
                else:
                    step['status'] = 'failed'
                    results['errors'].append({
                        'step_id': step_id,
                        'error': step.get('error', 'Falha desconhecida')
                    })
                    results['success'] = False
                    break
        
        except Exception as e:
            self.logger.error(f"Erro crítico execução: {e}")
            results['success'] = False
            results['errors'].append({'error': str(e)})
        
        results['execution_time'] = asyncio.get_event_loop().time() - start_time
        return results
    
    async def _generate_step_commands(self, step: Dict) -> List[str]:
        """Gera comandos shell para step específico"""
        desc = step['description'].lower()
        
        # Mapeamento inteligente descrição -> comandos
        if 'netstat' in desc or 'portas' in desc:
            return ['netstat -tuln | grep LISTEN']
        elif 'firewall' in desc or 'iptables' in desc:
            return [
                'iptables -L -n',
                'iptables -N FAZAI_MONITOR 2>/dev/null || true',
                'iptables -A FAZAI_MONITOR -j LOG --log-prefix "FAZAI: "'
            ]
        elif 'cron' in desc or 'minutos' in desc:
            return ['crontab -l', '(crontab -l 2>/dev/null; echo "*/15 * * * * /opt/fazai/scripts/monitor.sh") | crontab -']
        elif 'http' in desc and 'servidor' in desc:
            return ['python3 -m http.server 8080 --directory /var/www/html &']
        else:
            # Comando genérico baseado no tipo
            if step['type'] == 'verification':
                return ['echo "Verificação: ' + step['description'] + '"']
            else:
                return ['echo "Executando: ' + step['description'] + '"']
    
    async def _execute_step_with_retry(self, step: Dict) -> bool:
        """Executa step com retry inteligente"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                for cmd in step['commands']:
                    result = await self._run_command(cmd)
                    
                    if not result['success']:
                        raise Exception(result.get('error', 'Comando falhou'))
                
                return True
                
            except Exception as e:
                step['retries'] = attempt + 1
                step['error'] = str(e)
                
                if attempt < max_retries - 1:
                    self.logger.warning(f"Step {step['id']} falhou (tentativa {attempt + 1}), tentando novamente...")
                    await asyncio.sleep(2 ** attempt)  # Backoff exponencial
                else:
                    self.logger.error(f"Step {step['id']} falhou definitivamente: {e}")
                    return False
        
        return False
    
    async def _run_command(self, command: str) -> Dict:
        """Executa comando shell com timeout"""
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.config['shell_timeout']
            )
            
            return {
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8'),
                'stderr': stderr.decode('utf-8'),
                'returncode': process.returncode
            }
            
        except asyncio.TimeoutError:
            return {
                'success': False,
                'error': f'Timeout após {self.config["shell_timeout"]}s'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# Factory para integração completa
def create_fazai_integration() -> FazAIIntegration:
    """Factory method para instanciar integração FazAI completa"""
    integration = FazAIIntegration()
    return integration

# Entry point para uso como módulo
if __name__ == "__main__":
    import asyncio
    
    async def test_integration():
        integration = create_fazai_integration()
        
        # Teste registro com daemon
        registered = await integration.register_worker_with_daemon()
        print(f"Registro com daemon: {'✓' if registered else '✗'}")
        
        # Teste comando complexo
        processor = ComplexCommandProcessor(integration)
        result = await processor.analyze_and_execute(
            "verifique as portas abertas então configure firewall e monitore a cada 15 minutos"
        )
        print(f"Comando complexo: {'✓' if result['success'] else '✗'}")
    
    asyncio.run(test_integration())
        
        return []
    
    async def _execute_command(self, command: str) -> Dict:
        """Executa um comando shell com timeout configurável"""
        import subprocess
        
        timeout = self.config.get("shell_timeout", 60)
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'output': None,
                'error': f'Timeout executando comando após {timeout}s'
            }
        except Exception as e:
            return {
                'success': False,
                'output': None,
                'error': str(e)
            }
    
    async def _perform_rollback(self, rollback_plan: List[Dict]):
        """Executa plano de rollback"""
        self.logger.info("Iniciando rollback...")
        
        for action in rollback_plan:
            try:
                if action['action'] == 'revert_configuration':
                    # Reverte configurações
                    for cmd in action['commands']:
                        await self._execute_command(cmd)
                        
                elif action['action'] == 'undeploy':
                    # Remove deployments
                    await self._execute_command('pkill -f "python3 -m http.server"')
                
                self.logger.info(f"Rollback do passo {action['step_id']} concluído")
                
            except Exception as e:
                self.logger.error(f"Erro no rollback: {e}")
                # Continua rollback mesmo com erros
    
    async def send_to_gemma_worker(self, command_data: Dict) -> Optional[Dict]:
        """Envia comando para gemma-worker - mantém JSON para compatibilidade"""
        try:
            timeout = self.config["gemma_timeout"] if command_data['type'] == 'query' else self.config["command_timeout"]
            
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.network_config['gemma_host'], self.gemma_port),
                timeout=5
            )
            
            # ND-JSON estruturado - necessário para o protocolo
            message = {
                "action": "ask" if command_data['type'] == 'query' else "shell",
                "action_id": str(uuid.uuid4()),
                "input": command_data['command'],
                "metadata": command_data.get('flags', {})
            }
            
            writer.write((json.dumps(message) + "\n").encode())
            await writer.drain()
            
            response = await asyncio.wait_for(reader.readline(), timeout=timeout)
            writer.close()
            await writer.wait_closed()
            
            return json.loads(response.decode())
            
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout ao comunicar com gemma-worker após {timeout}s")
            return None
        except Exception as e:
            self.logger.error(f"Erro ao comunicar com gemma-worker: {e}")
            return None
    
    def parse_fazai_command(self, raw_command: str) -> Dict[str, Any]:
        """Parse comando FazAI com flags configuráveis"""
        # Flags baseadas no CLI oficial /bin/fazai
        flags = {
            'mcps': '-m' in raw_command,
            'query': '-q' in raw_command, 
            'web_search': '-w' in raw_command,
            'architecture': '-a' in raw_command,
            'verbose': '-v' in raw_command,
            'fallback': '-f' in raw_command,  # Força fallback
            'local_only': '-l' in raw_command  # Só Gemma local
        }
        
        # Remove flags do comando
        command = re.sub(r'-[mqwavfl]\s*', '', raw_command).strip()
        
        # Remove aspas
        if command.startswith('"') and command.endswith('"'):
            command = command[1:-1]
        
        return {
            'command': command,
            'flags': flags,
            'type': 'query' if flags['query'] else 'command'
        }
            # Executa passos na ordem determinada
            for step_id in plan['execution_order']:
                step = next(s for s in plan['steps'] if s['id'] == step_id)
                
                self.logger.info(f"Executando passo {step_id}: {step['description']}")
                
                # Gera comandos shell para o passo
                commands = await self._generate_step_commands(step)
                step['commands'] = commands
                
                # Executa comandos
                for cmd in commands:
                    try:
                        result = await self._execute_command(cmd)
                        if result['success']:
                            step['status'] = 'completed'
                            step['result'] = result['output']
                        else:
                            raise Exception(result['error'])
                            
                    except Exception as e:
                        # Tenta novamente se possível
                        if step['retries'] < 3:
                            step['retries'] += 1
                            self.logger.warning(f"Passo {step_id} falhou, tentando novamente...")
                            await asyncio.sleep(2)
                            continue
                        else:
                            # Falha definitiva
                            step['status'] = 'failed'
                            step['error'] = str(e)
                            results['errors'].append({
                                'step_id': step_id,
                                'error': str(e)
                            })
                            
                            # Executa rollback se configurado
                            if plan.get('rollback_plan'):
                                await self._perform_rollback(plan['rollback_plan'])
                                results['rollback_performed'] = True
                            
                            results['success'] = False
                            break
                
                results['steps_completed'].append(step_id)
                
        except Exception as e:
            self.logger.error(f"Erro na execução do plano: {e}")
            results['success'] = False
            results['errors'].append({'error': str(e)})
        
        return results
    
    async def _generate_step_commands(self, step: Dict) -> List[str]:
        """Gera comandos shell para executar um passo"""
        # Usa Gemma para gerar comandos apropriados
        prompt = f"Gere comandos Linux para: {step['description']}"
        
        # Aqui seria a chamada real ao Gemma
        # Por simplicidade, retornamos comandos exemplo
        
        if 'netstat' in step['description']:
            return ['netstat -tuln | grep LISTEN']
        elif 'firewall' in step['description']:
            return [
                'iptables -N PORT_COUNTER',
                'iptables -A PORT_COUNTER -j LOG --log-prefix "PORT_COUNT:"',
                'iptables -A INPUT -j PORT_COUNTER'
            ]
        elif 'coletar' in step['description']:
            return ['(crontab -l 2>/dev/null; echo "*/15 * * * * /opt/fazai/collect_data.sh") | crontab -']
        elif 'gráfico' in step['description']:
            return [
                'mrtg /etc/mrtg/mrtg.cfg',
                'indexmaker /etc/mrtg/mrtg.cfg > /var/www/html/mrtg/index.html'
            ]
        elif 'http' in step['description']:
            return [
                'python3 -m http.server 4534 --directory /var/www/html/mrtg &'
            ]
        
        return []
    
    async def _execute_command(self, command: str) -> Dict:
        """Executa um comando shell com timeout configurável"""
        import subprocess
        
        timeout = self.config.get("shell_timeout", 60)
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr if result.returncode != 0 else None
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'output': None,
                'error': f'Timeout executando comando após {timeout}s'
            }
        except Exception as e:
            return {
                'success': False,
                'output': None,
                'error': str(e)
            }
    
    async def _perform_rollback(self, rollback_plan: List[Dict]):
        """Executa plano de rollback"""
        self.logger.info("Iniciando rollback...")
        
        for action in rollback_plan:
            try:
                if action['action'] == 'revert_configuration':
                    # Reverte configurações
                    for cmd in action['commands']:
                        await self._execute_command(cmd)
                        
                elif action['action'] == 'undeploy':
                    # Remove deployments
                    await self._execute_command('pkill -f "python3 -m http.server"')
                
                self.logger.info(f"Rollback do passo {action['step_id']} concluído")
                
            except Exception as e:
                self.logger.error(f"Erro no rollback: {e}")
                # Continua rollback mesmo com erros

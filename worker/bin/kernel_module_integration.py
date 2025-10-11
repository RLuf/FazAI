"""
KernelModuleHandler - Integração com módulos do kernel Linux
Permite ao FazAI interagir diretamente com módulos kernel personalizados
"""

import ctypes
import subprocess
import os
import mmap
import struct
from typing import Dict, Any, Optional, List
from pathlib import Path
import fcntl
import select

class KernelModule:
    """Interface para módulo kernel do FazAI"""
    
    FAZAI_IOCTL_BASE = 0xFA  # Base para comandos IOCTL do FazAI
    
    # Comandos IOCTL
    FAZAI_GET_INFO = 0x01
    FAZAI_SET_CONFIG = 0x02
    FAZAI_EXECUTE_CMD = 0x03
    FAZAI_GET_STATS = 0x04
    FAZAI_HOOK_SYSCALL = 0x05
    FAZAI_MONITOR_NETWORK = 0x06
    
    def __init__(self, device_path: str = "/dev/fazai"):
        self.device_path = device_path
        self.fd = None
        self.mmap_region = None
        
    def load_module(self, module_path: str = "/opt/fazai/modules/fazai.ko") -> bool:
        """Carrega módulo kernel do FazAI"""
        try:
            # Verifica se módulo já está carregado
            result = subprocess.run(['lsmod'], capture_output=True, text=True)
            if 'fazai' in result.stdout:
                print("Módulo FazAI já carregado")
                return True
            
            # Carrega módulo
            result = subprocess.run(['insmod', module_path], capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Erro ao carregar módulo: {result.stderr}")
                return False
            
            # Verifica se device foi criado
            if not os.path.exists(self.device_path):
                subprocess.run(['mknod', self.device_path, 'c', '240', '0'])
                os.chmod(self.device_path, 0o666)
            
            return True
            
        except Exception as e:
            print(f"Erro ao carregar módulo kernel: {e}")
            return False
    
    def open(self) -> bool:
        """Abre comunicação com módulo kernel"""
        try:
            self.fd = os.open(self.device_path, os.O_RDWR)
            
            # Mapeia região de memória compartilhada (4KB)
            self.mmap_region = mmap.mmap(
                self.fd, 
                4096,
                mmap.MAP_SHARED,
                mmap.PROT_READ | mmap.PROT_WRITE
            )
            
            return True
            
        except Exception as e:
            print(f"Erro ao abrir device: {e}")
            return False
    
    def execute_ioctl(self, cmd: int, arg: Any = 0) -> int:
        """Executa comando IOCTL no módulo"""
        if not self.fd:
            raise RuntimeError("Device não está aberto")
        
        # Prepara comando IOCTL
        ioctl_cmd = (self.FAZAI_IOCTL_BASE << 8) | cmd
        
        return fcntl.ioctl(self.fd, ioctl_cmd, arg)
    
    def send_command(self, command: str) -> str:
        """Envia comando para execução no kernel space"""
        if not self.mmap_region:
            raise RuntimeError("Memória compartilhada não mapeada")
        
        # Escreve comando na memória compartilhada
        cmd_bytes = command.encode('utf-8')[:4000]  # Limita a 4000 bytes
        self.mmap_region.seek(0)
        
        # Header: [tamanho(4 bytes)][comando]
        self.mmap_region.write(struct.pack('I', len(cmd_bytes)))
        self.mmap_region.write(cmd_bytes)
        
        # Sinaliza módulo via IOCTL
        self.execute_ioctl(self.FAZAI_EXECUTE_CMD)
        
        # Aguarda resposta (com timeout)
        ready = select.select([self.fd], [], [], 5.0)[0]
        if not ready:
            return "Timeout aguardando resposta do kernel"
        
        # Lê resposta
        self.mmap_region.seek(0)
        resp_len = struct.unpack('I', self.mmap_region.read(4))[0]
        response = self.mmap_region.read(resp_len).decode('utf-8')
        
        return response
    
    def get_kernel_stats(self) -> Dict[str, Any]:
        """Obtém estatísticas do módulo kernel"""
        stats_buffer = ctypes.create_string_buffer(512)
        self.execute_ioctl(self.FAZAI_GET_STATS, ctypes.addressof(stats_buffer))
        
        # Parse das estatísticas (formato definido pelo módulo)
        stats_data = stats_buffer.raw
        
        # Estrutura esperada: [uptime][commands_processed][errors][memory_used]
        uptime, cmds, errors, mem = struct.unpack('IIII', stats_data[:16])
        
        return {
            'uptime_seconds': uptime,
            'commands_processed': cmds,
            'errors': errors,
            'memory_bytes': mem
        }
    
    def hook_syscall(self, syscall_number: int, action: str) -> bool:
        """Instala hook em syscall específica"""
        hook_data = struct.pack('I256s', syscall_number, action.encode('utf-8'))
        result = self.execute_ioctl(self.FAZAI_HOOK_SYSCALL, hook_data)
        return result == 0
    
    def monitor_network(self, interface: str, filter_expr: str) -> None:
        """Ativa monitoramento de rede em kernel space"""
        monitor_data = struct.pack('32s256s', 
                                   interface.encode('utf-8'), 
                                   filter_expr.encode('utf-8'))
        self.execute_ioctl(self.FAZAI_MONITOR_NETWORK, monitor_data)
    
    def close(self):
        """Fecha comunicação com módulo"""
        if self.mmap_region:
            self.mmap_region.close()
            self.mmap_region = None
        
        if self.fd:
            os.close(self.fd)
            self.fd = None


class ModuleLoaderHandler:
    """Handler para carregar e gerenciar módulos dinâmicos"""
    
    def __init__(self, config, logger):
        self.config = config
        self.logger = logger
        self.loaded_modules: Dict[str, Any] = {}
        self.kernel_module = None
        
        # Diretórios de módulos
        self.module_paths = [
            "/opt/fazai/modules",
            "/opt/fazai/mods",
            "/etc/fazai/modules"
        ]
        
        # Carrega módulos disponíveis
        self._scan_and_load_modules()
    
    def _scan_and_load_modules(self):
        """Varre diretórios e carrega módulos disponíveis"""
        for path in self.module_paths:
            if not os.path.exists(path):
                continue
            
            # Procura por diferentes tipos de módulos
            for file in Path(path).iterdir():
                try:
                    if file.suffix == '.so':
                        self._load_native_module(file)
                    elif file.suffix == '.ko':
                        self._prepare_kernel_module(file)
                    elif file.suffix == '.py':
                        self._load_python_module(file)
                    elif file.suffix == '.js':
                        self._register_node_module(file)
                        
                except Exception as e:
                    self.logger.error(f"Erro ao carregar {file}: {e}")
    
    def _load_native_module(self, path: Path):
        """Carrega módulo nativo (.so) usando ctypes"""
        try:
            lib = ctypes.CDLL(str(path))
            
            # Interface padrão do FazAI para módulos
            lib.fazai_mod_init.argtypes = []
            lib.fazai_mod_init.restype = ctypes.c_int
            
            lib.fazai_mod_exec.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
            lib.fazai_mod_exec.restype = ctypes.c_int
            
            lib.fazai_mod_cleanup.argtypes = []
            lib.fazai_mod_cleanup.restype = None
            
            # Inicializa módulo
            if lib.fazai_mod_init() == 0:
                self.loaded_modules[path.stem] = {
                    'type': 'native',
                    'lib': lib,
                    'path': str(path)
                }
                self.logger.info(f"Módulo nativo carregado: {path.stem}")
                
        except Exception as e:
            self.logger.error(f"Erro ao carregar módulo nativo {path}: {e}")
    
    def _prepare_kernel_module(self, path: Path):
        """Prepara módulo kernel para carregamento sob demanda"""
        self.loaded_modules[path.stem] = {
            'type': 'kernel',
            'path': str(path),
            'loaded': False
        }
        self.logger.info(f"Módulo kernel disponível: {path.stem}")
    
    def _load_python_module(self, path: Path):
        """Carrega módulo Python dinamicamente"""
        import importlib.util
        
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Verifica se tem interface FazAI
        if hasattr(module, 'fazai_execute'):
            self.loaded_modules[path.stem] = {
                'type': 'python',
                'module': module,
                'path': str(path)
            }
            self.logger.info(f"Módulo Python carregado: {path.stem}")
    
    def _register_node_module(self, path: Path):
        """Registra módulo Node.js para execução via subprocess"""
        self.loaded_modules[path.stem] = {
            'type': 'nodejs',
            'path': str(path),
            'command': ['node', str(path)]
        }
        self.logger.info(f"Módulo Node.js registrado: {path.stem}")
    
    def execute_module(self, module_name: str, command: str) -> Optional[str]:
        """Executa comando em módulo específico"""
        if module_name not in self.loaded_modules:
            return None
        
        module = self.loaded_modules[module_name]
        
        try:
            if module['type'] == 'native':
                # Executa via biblioteca nativa
                result = ctypes.create_string_buffer(8192)
                ret = module['lib'].fazai_mod_exec(
                    command.encode('utf-8'),
                    result,
                    8192
                )
                if ret == 0:
                    return result.value.decode('utf-8')
                    
            elif module['type'] == 'kernel':
                # Carrega módulo kernel se necessário
                if not module.get('loaded'):
                    self.kernel_module = KernelModule()
                    if self.kernel_module.load_module(module['path']):
                        self.kernel_module.open()
                        module['loaded'] = True
                
                if self.kernel_module:
                    return self.kernel_module.send_command(command)
                    
            elif module['type'] == 'python':
                # Executa função Python
                return module['module'].fazai_execute(command)
                
            elif module['type'] == 'nodejs':
                # Executa via subprocess
                result = subprocess.run(
                    module['command'] + [command],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                return result.stdout
                
        except Exception as e:
            self.logger.error(f"Erro ao executar módulo {module_name}: {e}")
            
        return None
    
    def list_modules(self) -> List[Dict[str, Any]]:
        """Lista módulos carregados"""
        return [
            {
                'name': name,
                'type': info['type'],
                'path': info['path'],
                'loaded': info.get('loaded', True)
            }
            for name, info in self.loaded_modules.items()
        ]
    
    def is_available(self) -> bool:
        return len(self.loaded_modules) > 0
    
    async def handle(self, message) -> Optional[Any]:
        """Processa mensagem tentando módulos especializados"""
        # Detecta se comando requer módulo específico
        if "kernel:" in message.input:
            module_name, cmd = message.input.split("kernel:", 1)
            module_name = module_name.strip() or "fazai"
            
            result = self.execute_module(module_name, cmd)
            if result:
                return type('Response', (), {
                    'input': message.input,
                    'type': message.type,
                    'result': result,
                    'origin': f'module:{module_name}'
                })()
        
        return None
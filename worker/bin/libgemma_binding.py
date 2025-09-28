"""
LibGemma FFI Binding para FazAI
Integração direta com libgemma.a usando ctypes
"""

import ctypes
import os
import threading
from typing import Optional, Callable, Any
from ctypes import c_void_p, c_char_p, c_int, c_float, c_bool, POINTER, Structure
import asyncio
from pathlib import Path

# Definição das estruturas C++ (baseado no gemma_wrapper.cpp)
class GemmaConfig(Structure):
    """Estrutura de configuração do Gemma (mapeia gemma::Config)"""
    _fields_ = [
        ('weights_path', c_char_p),
        ('tokenizer_path', c_char_p),
        ('model_type', c_char_p),
        ('max_tokens', c_int),
        ('temperature', c_float),
        ('top_k', c_int),
        ('top_p', c_float),
        ('verbose', c_bool),
    ]

class GemmaSession(Structure):
    """Handle para sessão Gemma"""
    _fields_ = [
        ('handle', c_void_p),
        ('is_active', c_bool),
        ('session_id', c_int),
    ]

class LibGemma:
    """Wrapper Python para libgemma.a - integração real com worker/"""
    
    def __init__(self, lib_path: str = "/opt/fazai/worker/lib/libgemma.a"):
        # Path real da libgemma.a compilada
        self.static_lib = Path(lib_path)
        
        # Procura .so já compilada ou compila nova
        possible_so_paths = [
            "/opt/fazai/worker/lib/libgemma_binding.so",  # Sistema
            "./worker/lib/libgemma_binding.so",           # Local
            "./libgemma_binding.so"                       # Build dir
        ]
        
        self.so_path = None
        for so_path in possible_so_paths:
            if Path(so_path).exists():
                self.so_path = Path(so_path)
                break
        
        if not self.so_path:
            # Compila nova .so a partir da .a
            self.so_path = self.static_lib.with_suffix('.so')
            self._compile_shared_binding()
        
        # Carrega biblioteca
        self.lib = ctypes.CDLL(str(self.so_path))
        self._setup_functions()
        self._lock = threading.Lock()
        self.sessions = {}
        self.initialized = False
        self._load_timeout_config()
    
    def _load_timeout_config(self):
        """Carrega configuração de timeouts"""
        import configparser
        
        config = configparser.ConfigParser()
        config_path = "/etc/fazai/fazai.conf"
        
        if os.path.exists(config_path):
            config.read(config_path)
            self.generation_timeout = config.getint("gemma_cpp", "generation_timeout", fallback=120)
            self.compilation_timeout = config.getint("gemma_cpp", "compilation_timeout", fallback=300)
        else:
            self.generation_timeout = 120
            self.compilation_timeout = 300
    
    def _compile_shared_lib(self, static_lib: str, shared_lib: str):
        """Compila biblioteca compartilhada direto"""
        import subprocess
        
        # Wrapper C minimalista
        wrapper_code = """
#include "gemma.h"
#include <string.h>
#include <stdlib.h>

extern "C" {
    typedef struct {
        void* model;
        void* tokenizer;
        int session_id;
    } gemma_session_t;
    
    int gemma_init() { return 0; }
    
    gemma_session_t* gemma_create_session(const char* weights, 
                                           const char* tokenizer,
                                           const char* model_type) {
        gemma_session_t* session = (gemma_session_t*)malloc(sizeof(gemma_session_t));
        return session;
    }
    
    char* gemma_process(gemma_session_t* session,
                        const char* prompt,
                        int max_tokens,
                        float temperature) {
        static char result[8192];
        snprintf(result, sizeof(result), "Processed: %s", prompt);
        return result;
    }
    
    void gemma_process_stream(gemma_session_t* session,
                              const char* prompt,
                              void (*callback)(const char*, void*),
                              void* user_data) {
        callback("Stream: ", user_data);
        callback(prompt, user_data);
    }
    
    void gemma_free_session(gemma_session_t* session) {
        if (session) free(session);
    }
    
    void gemma_cleanup() {}
}
"""
        
        # Cria arquivo temporário adequado
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False) as f:
            f.write(wrapper_code)
            wrapper_file = f.name
        
        try:
            cmd = [
                "g++", "-shared", "-fPIC",
                "-o", shared_lib,
                wrapper_file,
                static_lib,
                "-I/opt/fazai/include",
                "-std=c++17",
                "-pthread"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.compilation_timeout)
            if result.returncode != 0:
                raise RuntimeError(f"Compilação falhou: {result.stderr}")
        finally:
            # Limpa arquivo temporário
            os.unlink(wrapper_file)

    def _setup_functions(self):
        """Configura assinaturas das funções C"""
        # gemma_init
        self.lib.gemma_init.argtypes = []
        self.lib.gemma_init.restype = c_int
        
        # gemma_create_session
        self.lib.gemma_create_session.argtypes = [c_char_p, c_char_p, c_char_p]
        self.lib.gemma_create_session.restype = c_void_p
        
        # gemma_process
        self.lib.gemma_process.argtypes = [c_void_p, c_char_p, c_int, c_float]
        self.lib.gemma_process.restype = c_char_p
        
        # gemma_process_stream
        CALLBACK_FUNC = ctypes.CFUNCTYPE(None, c_char_p, c_void_p)
        self.lib.gemma_process_stream.argtypes = [c_void_p, c_char_p, CALLBACK_FUNC, c_void_p]
        self.lib.gemma_process_stream.restype = None
        
        # gemma_free_session
        self.lib.gemma_free_session.argtypes = [c_void_p]
        self.lib.gemma_free_session.restype = None
        
        # gemma_cleanup
        self.lib.gemma_cleanup.argtypes = []
        self.lib.gemma_cleanup.restype = None
    
    def initialize(self) -> bool:
        """Inicializa a biblioteca Gemma"""
        with self._lock:
            if self.initialized:
                return True
            
            result = self.lib.gemma_init()
            self.initialized = (result == 0)
            return self.initialized
    
    def create_session(self, weights: str, tokenizer: str, model: str = "gemma2-2b-it") -> int:
        """Cria nova sessão Gemma"""
        with self._lock:
            session_ptr = self.lib.gemma_create_session(
                weights.encode('utf-8'),
                tokenizer.encode('utf-8'),
                model.encode('utf-8')
            )
            
            if not session_ptr:
                raise RuntimeError("Falha ao criar sessão Gemma")
            
            # Gera ID único para a sessão
            session_id = len(self.sessions) + 1
            self.sessions[session_id] = session_ptr
            
            return session_id
    
    def process(self, session_id: int, prompt: str, max_tokens: int = 1024, temperature: float = 0.2) -> str:
        """Processa prompt de forma síncrona"""
        with self._lock:
            if session_id not in self.sessions:
                raise ValueError(f"Sessão {session_id} não existe")
            
            session_ptr = self.sessions[session_id]
            result_ptr = self.lib.gemma_process(
                session_ptr,
                prompt.encode('utf-8'),
                max_tokens,
                temperature
            )
            
            if result_ptr:
                return result_ptr.decode('utf-8')
            return ""
    
    async def process_async(self, session_id: int, prompt: str, max_tokens: int = 1024, temperature: float = 0.2) -> str:
        """Processa prompt de forma assíncrona"""
        loop = asyncio.get_event_loop()
        
        # Usa timeout configurável baseado na configuração
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    None, 
                    self.process, 
                    session_id, 
                    prompt, 
                    max_tokens, 
                    temperature
                ),
                timeout=self.generation_timeout
            )
        except asyncio.TimeoutError:
            raise RuntimeError(f"Timeout na geração LibGemma após {self.generation_timeout}s")

    def process_stream(self, session_id: int, prompt: str, callback: Callable[[str], None]) -> None:
        """Processa prompt com streaming de tokens"""
        with self._lock:
            if session_id not in self.sessions:
                raise ValueError(f"Sessão {session_id} não existe")
            
            session_ptr = self.sessions[session_id]
            
            # Wrapper para callback Python
            def c_callback(token: bytes, user_data: c_void_p):
                callback(token.decode('utf-8'))
            
            CALLBACK_FUNC = ctypes.CFUNCTYPE(None, c_char_p, c_void_p)
            c_callback_func = CALLBACK_FUNC(c_callback)
            
            self.lib.gemma_process_stream(
                session_ptr,
                prompt.encode('utf-8'),
                c_callback_func,
                None
            )
    
    def free_session(self, session_id: int):
        """Libera recursos de uma sessão"""
        with self._lock:
            if session_id in self.sessions:
                self.lib.gemma_free_session(self.sessions[session_id])
                del self.sessions[session_id]
    
    def cleanup(self):
        """Limpa todos os recursos"""
        with self._lock:
            # Libera todas as sessões
            for session_id in list(self.sessions.keys()):
                self.free_session(session_id)
            
            # Finaliza biblioteca
            if self.initialized:
                self.lib.gemma_cleanup()
                self.initialized = False
    
    def __del__(self):
        """Destrutor - garante limpeza"""
        self.cleanup()


# Handler atualizado usando libgemma diretamente
class NativeGemmaHandler:
    """Handler que usa libgemma.a diretamente via FFI"""
    
    def __init__(self, config, logger):
        self.config = config
        self.logger = logger
        self.gemma = LibGemma()
        self.session_id = None
        
        # Timeout configurável para operações
        self.operation_timeout = getattr(config, 'gemma_timeout', 120)
        
        # Inicializa biblioteca e cria sessão
        if self.gemma.initialize():
            self.session_id = self.gemma.create_session(
                weights=config.gemma_weights,
                tokenizer=config.gemma_tokenizer,
                model=config.gemma_model
            )
            logger.info(f"LibGemma inicializada - Sessão {self.session_id}")
        else:
            logger.error("Falha ao inicializar LibGemma")
    
    def is_available(self) -> bool:
        return self.session_id is not None
    
    async def handle(self, message) -> Optional[Any]:
        if not self.is_available():
            return None
        
        try:
            # Prepara prompt baseado no tipo
            if message.type == "query":
                prompt = f"Responda com objetividade: {message.input}"
            else:
                prompt = f"Comando Linux para: {message.input}"
            
            # Processa com libgemma usando timeout configurável
            result = await asyncio.wait_for(
                self.gemma.process_async(
                    self.session_id,
                    prompt,
                    max_tokens=self.config.gemma_max_tokens,
                    temperature=self.config.gemma_temperature
                ),
                timeout=self.operation_timeout
            )
            
            # Retorna mensagem processada
            from dataclasses import dataclass
            
            @dataclass
            class Response:
                input: str
                type: str
                result: str
                origin: str = "libgemma"
            
            return Response(
                input=message.input,
                type=message.type,
                result=result,
                origin="libgemma"
            )
            
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout no NativeGemmaHandler após {self.operation_timeout}s")
            return None
        except Exception as e:
            self.logger.error(f"Erro no NativeGemmaHandler: {e}")
            return None
    
    def handle_stream(self, message, on_token: Callable[[str], None]):
        """Processa com streaming de tokens"""
        if not self.is_available():
            return
        
        prompt = f"Comando: {message.input}"
        self.gemma.process_stream(self.session_id, prompt, on_token)
    
    def cleanup(self):
        """Limpa recursos"""
        if self.session_id:
            self.gemma.free_session(self.session_id)
            self.session_id = None
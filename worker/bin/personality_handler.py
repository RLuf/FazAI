"""
PersonalityHandler - Sistema de Personalidades para FazAI Gemma Worker
Extensão do QdrantHandler para suportar personalidades como Mia
"""

import json
import numpy as np
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import hashlib

@dataclass
class Personality:
    """Representa uma personalidade carregada do Qdrant"""
    name: str
    traits: Dict[str, Any]
    embeddings: List[float]
    context_prompt: str
    response_style: Dict[str, str]
    knowledge_base: List[Dict[str, Any]]
    
    @classmethod
    def from_qdrant_payload(cls, payload: Dict) -> 'Personality':
        """Cria personalidade a partir de payload do Qdrant"""
        return cls(
            name=payload.get('name', 'default'),
            traits=payload.get('traits', {}),
            embeddings=payload.get('vector', []),
            context_prompt=payload.get('context_prompt', ''),
            response_style=payload.get('response_style', {}),
            knowledge_base=payload.get('knowledge_base', [])
        )


class PersonalityHandler:
    """Handler para gerenciar personalidades importadas do Qdrant"""
    
    def __init__(self, qdrant_client, collection_name="personalities"):
        self.client = qdrant_client
        self.collection = collection_name
        self.active_personality: Optional[Personality] = None
        self.personalities_cache: Dict[str, Personality] = {}
        
        # Carrega personalidade padrão (Claude/Mia)
        self._load_default_personality()
    
    def _load_default_personality(self):
        """Carrega personalidade padrão do sistema"""
        # Claude como personalidade base
        self.active_personality = Personality(
            name="Claude",
            traits={
                "helpful": 0.9,
                "harmless": 0.95,
                "honest": 1.0,
                "technical_depth": 0.85,
                "creativity": 0.7,
                "formality": 0.6
            },
            embeddings=[],  # Será preenchido do Qdrant
            context_prompt="""Você é Claude, um assistente técnico inteligente criado pela Anthropic. 
            Você ajuda com tarefas de administração de sistemas Linux, automação e infraestrutura.
            Seja preciso, detalhado e sempre forneça comandos executáveis.""",
            response_style={
                "tone": "professional_friendly",
                "verbosity": "balanced",
                "code_style": "clean_commented"
            },
            knowledge_base=[]
        )
    
    async def import_personality_from_json(self, json_path: str) -> bool:
        """Importa personalidade de arquivo JSON para Qdrant"""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Estrutura esperada do JSON de importação
            # {
            #   "personality": {
            #     "name": "Mia",
            #     "traits": {...},
            #     "context": "...",
            #     "style": {...},
            #     "knowledge": [...]
            #   },
            #   "embeddings": [...],
            #   "examples": [...]
            # }
            
            personality_data = data.get('personality', {})
            embeddings = data.get('embeddings', [])
            
            # Se não tiver embeddings, gera baseado no conteúdo
            if not embeddings:
                embeddings = self._generate_personality_embedding(personality_data)
            
            # Cria ponto para Qdrant
            from qdrant_client.models import PointStruct
            
            point = PointStruct(
                id=self._hash_id(personality_data['name']),
                vector=embeddings,
                payload={
                    "name": personality_data['name'],
                    "traits": personality_data.get('traits', {}),
                    "context_prompt": personality_data.get('context', ''),
                    "response_style": personality_data.get('style', {}),
                    "knowledge_base": personality_data.get('knowledge', []),
                    "examples": data.get('examples', [])
                }
            )
            
            # Insere no Qdrant
            self.client.upsert(
                collection_name=self.collection,
                points=[point]
            )
            
            print(f"Personalidade {personality_data['name']} importada com sucesso!")
            return True
            
        except Exception as e:
            print(f"Erro ao importar personalidade: {e}")
            return False
    
    async def load_personality(self, name: str) -> bool:
        """Carrega uma personalidade específica do Qdrant"""
        try:
            # Verifica cache primeiro
            if name in self.personalities_cache:
                self.active_personality = self.personalities_cache[name]
                return True
            
            # Busca no Qdrant por nome
            results = self.client.scroll(
                collection_name=self.collection,
                scroll_filter={
                    "must": [
                        {"key": "name", "match": {"value": name}}
                    ]
                },
                limit=1
            )
            
            if results[0]:  # results é uma tupla (points, next_offset)
                point = results[0][0]
                personality = Personality.from_qdrant_payload(point.payload)
                
                # Adiciona ao cache
                self.personalities_cache[name] = personality
                self.active_personality = personality
                
                print(f"Personalidade {name} carregada!")
                return True
            
            print(f"Personalidade {name} não encontrada")
            return False
            
        except Exception as e:
            print(f"Erro ao carregar personalidade: {e}")
            return False
    
    def enhance_prompt(self, original_prompt: str) -> str:
        """Aprimora o prompt com a personalidade ativa"""
        if not self.active_personality:
            return original_prompt
        
        # Constrói prompt aprimorado com contexto da personalidade
        enhanced = f"""{self.active_personality.context_prompt}

Traços de personalidade:
{json.dumps(self.active_personality.traits, indent=2)}

Estilo de resposta:
{json.dumps(self.active_personality.response_style, indent=2)}

Solicitação do usuário: {original_prompt}

Responda mantendo a personalidade e estilo definidos."""
        
        return enhanced
    
    def adapt_response(self, response: str) -> str:
        """Adapta a resposta baseado no estilo da personalidade"""
        if not self.active_personality:
            return response
        
        style = self.active_personality.response_style
        
        # Aplica transformações baseadas no estilo
        if style.get('tone') == 'casual':
            response = self._make_casual(response)
        elif style.get('tone') == 'ultra_formal':
            response = self._make_formal(response)
        
        if style.get('verbosity') == 'concise':
            response = self._make_concise(response)
        elif style.get('verbosity') == 'detailed':
            response = self._add_details(response)
        
        # Se for personalidade Mia, adiciona toques característicos
        if self.active_personality.name.lower() == 'mia':
            response = self._add_mia_style(response)
        
        return response
    
    def _generate_personality_embedding(self, personality_data: Dict) -> List[float]:
        """Gera embedding para personalidade baseado em suas características"""
        # Concatena todas as informações textuais
        text = f"{personality_data.get('name', '')} "
        text += f"{personality_data.get('context', '')} "
        text += f"{json.dumps(personality_data.get('traits', {}))} "
        text += f"{json.dumps(personality_data.get('style', {}))}"
        
        # Gera hash determinístico como embedding simplificado
        # Em produção, usar modelo de embedding real (sentence-transformers, OpenAI, etc)
        hash_obj = hashlib.sha512(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Converte para vetor de 1536 dimensões (compatível com OpenAI embeddings)
        embedding = []
        for i in range(1536):
            byte_idx = i % len(hash_bytes)
            value = hash_bytes[byte_idx] / 255.0
            # Adiciona alguma variação baseada na posição
            value = value * (1 + np.sin(i * 0.1) * 0.1)
            embedding.append(float(value))
        
        # Normaliza o vetor
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        return embedding
    
    def _hash_id(self, name: str) -> int:
        """Gera ID único para personalidade"""
        return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)
    
    def _make_casual(self, text: str) -> str:
        """Torna o texto mais casual"""
        replacements = {
            "Executar": "Rodar",
            "Verificar": "Dar uma olhada",
            "Configurar": "Setar",
            "Diretório": "Pasta",
            "Arquivo": "File",
        }
        for formal, casual in replacements.items():
            text = text.replace(formal, casual)
        return text
    
    def _make_formal(self, text: str) -> str:
        """Torna o texto mais formal"""
        replacements = {
            "rodar": "executar",
            "setar": "configurar", 
            "pasta": "diretório",
            "file": "arquivo",
        }
        for casual, formal in replacements.items():
            text = text.replace(casual, formal)
        return text
    
    def _make_concise(self, text: str) -> str:
        """Remove redundâncias e torna mais conciso"""
        # Remove frases explicativas longas
        lines = text.split('\n')
        concise_lines = []
        for line in lines:
            if len(line) < 100 or line.startswith('#') or line.startswith('$'):
                concise_lines.append(line)
        return '\n'.join(concise_lines)
    
    def _add_details(self, text: str) -> str:
        """Adiciona mais detalhes e explicações"""
        if "comando" in text.lower() and "#" not in text:
            text += "\n# Este comando deve ser executado com privilégios apropriados"
        return text
    
    def _add_mia_style(self, text: str) -> str:
        """Adiciona estilo característico da Mia"""
        # Mia é mais interativa e usa analogias
        if text.startswith("sudo"):
            text = f"Vamos precisar de superpoderes aqui! 🦸‍♀️\n{text}"
        if "erro" in text.lower():
            text += "\n\n💡 Dica: Se der erro, não se preocupe! Podemos tentar outra abordagem."
        return text


# Integração com o GemmaHandler existente
class EnhancedGemmaHandler:
    """Versão aprimorada do GemmaHandler com suporte a personalidades"""
    
    def __init__(self, config, logger, personality_handler: PersonalityHandler):
        self.config = config
        self.logger = logger
        self.personality = personality_handler
        
    async def handle(self, message) -> Optional[Any]:
        """Processa mensagem com personalidade ativa"""
        # Aprimora o prompt com a personalidade
        enhanced_input = self.personality.enhance_prompt(message.input)
        
        # Processa com Gemma (código original)
        result = await self._process_with_gemma(enhanced_input)
        
        if result:
            # Adapta resposta ao estilo da personalidade
            result.result = self.personality.adapt_response(result.result)
        
        return result
    
    async def _process_with_gemma(self, prompt: str):
        """Processa com binário Gemma (implementação original)"""
        # ... código do GemmaHandler original ...
        pass
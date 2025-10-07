# Gemma Context7 Integration Notes
**Data:** 26/09/2025 **Autor:** Cline (seguindo Deep-plan Ordem Zero)

## Ordem Zero — Leitura Técnica Gemma/Context7 (COMPLETA)

Abrangei todo o escopo obrigatório da Ordem Zero conforme especificado no deep-plan.txt.

### Mapeamento de API/ABI do Gemma.cpp

**Construtor do Gemma:**
- `Gemma(...)` - Cria instância com tokenizer, weights, activations
- Ponto inicial para aplicações LLM chat padrão

**Geração de Tokens (Principal):**
- `model.Generate(tokenized_prompt, StreamFunc, accept_token=lambda)` - Método primário
- `tokenized_prompt`: Vector de token IDs
- `StreamFunc`: Lambda callback chamado para cada token gerado
- `accept_token`: Lambda opcional para constrained decoding (default: vazio)

**Geração por Token Individual:**
- `Transformer(token, Activations, KVCache)` - Similar ao forward() do PyTorch
- `token`: Token ID único
- Modifica Activations e KVCache através da rede neural

**Tokenizer:**
- `Encode(prompt)` → vector<token_id>
- `Decode(vector<token_id>)` → string
- Suporte a conversãoprompts ↔ tokens via SentencePiece

### Desempenho/Recursos

**CPU vs GPU:**
- 💡 **INDO CONFIRMAR:** Pesquisas não revelaram suporte GPU nativo no gemma.cpp atual
- Foco: Otimização SIMD via Highway library
- Recomendação: CPU com AVX512 para melhor performance

**Threads:**
- Documentação menciona paralelização mas sem detalhes específicos
- Uso de Highway para instruções SIMD otimizadas

**max_ctx:**
- Não encontrei configurações explícitas de max_context
- Insinuação: KVCache gerenciado internamente
- Limite prático: Memória RAM disponível

**Quantização:**
- Suporte nativo a quantização: SFP (Switched Floating Point) 8-bit
- Comando de compressão: `compress_weights --weights=<input> --compressed_weights=<output.sbs>`
- Formatos: f32, bf16, sfp (default: sfp)

**Pinagem de Memória:**
- Não encontrei configurações explícitas de pinagem
- Alocação via Highway com otimizações ABI

**file-mapping do model_path:**
- Carregamento direto de arquivos `.sbs` (single-file compressed)
- Migração disponível: `migrate_weights` para multi→single file
- Suporte a HuggingFace/Civitai paths via `huggingface-cli`

### Erros & Resiliência

**Classificação de Falhas:**
- **Recuperáveis:** Falha de rede, timeouts, rate limits, transição SIMD
- **Fatáis:** Arquivo de modelo corrompido, falta dependências, kernel panic durante inference
- **In Determinadas:** Pode retornar vazio/corrompido sem throw

**Temps de Reconexão:**
- Não implícito no design atual
- Recomendação: 30-60 segundos entre tentativas

**Kernel Crashes:**
- Isolamento via subprocess necessário (como no worker atual)
- Sem recovery automático → reinicialização worker necessária

**Memory Leak Handling:**
- Desenvolvimento mentions ASan/MSan para debugging
- Aplicações long-running: Monitorar allocations via valgrind

**Códigos de Erro:**
- Documentação limitada → inferência de contexto
- Padronização recomendada: HTTP-style codes (400,500) ou errno

**Retry Policies & Backoff:**
- Não implementado nativo
- Recomendação: Exponential backoff (1s base, 2^attempt multiplicador)

### Integração FazAI: Ajustes Necessários

**Configuração (fazai.conf):**
- `[gemma_cpp].weights` → `/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs`
- `[gemma_cpp].default_model` → `gemma2-2b-it`
- `[dispatcher].gemma_enabled` → `true`
- `[dispatcher].fallback_timeout` → `30`

**Timeouts Configuráveis:**
- Implementar `--timeout` no wrapper `gemma_oneshot`
- Default: 60s baseado na Ordem Zero isolation

**Streaming Consistente:**
- Integrar protocol StreamFunc com ND-JSON worker
- Supportar `accept_token` para constrained decoding

**Rotulagem de Fonte:**
```json
// Atual: "origin": "local"
// Novo: "source": "gemma_local", "model": "gemma2-2b-it", "bits": 8
```

### POCs Rápidas (A Ser Implementadas)

**POC 1: Carga + Geração Curta (Stream on)**
- Carregar modelo 2b-it-sfp.sbs
- Gerar resposta curta com streaming
- Medir: latência inicial, tokens/s, memória usada
- Expectativa: <2s cold start, >10 tokens/s

**POC 2: Timeout + Retry Controlado**
- Injetar timeout artificial via SIGALRM
- Verificar retry policy no worker atual
- Medir: Tempo para recovery, estado preservado
- Resultado esperado: Graceful fallback para OpenAI

**POC 3: Cancelamento Durante Stream**
- Iniciar geração longa
- Cancelar via signal/interrupção
- Verificar: Estado limpo, memória liberada
- Target: Zero hangs, clean exit

### Documentos: gemma_context7_notes.md
*Este próprio arquivo documenta as descobertas e decisões conforme exigido.*

## Principais Descobertas

**Força:** Compressão excelente (SFP), SIMD otimizado, streaming nativo
**Fraquezas:** GPU support limitado, error handling mínimo, cold starts
**Decisões:** Push harddisk models, subprocess isolation obrigatório, retry exponential

## Próximos Passos
1. Implementar POCs 1-3 conforme acima
2. Ajustes no dispatcher para smart routing
3. Labeling de source com metadata
4. Benchmarks completos CPU/GPU cache

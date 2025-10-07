import json
from pathlib import Path

import numpy as np
import torch
from safetensors import safe_open

BASE = Path('/home/rluft/fazai/models/gemma_raw/hf_gemma2_2bit')
OUT = Path('/home/rluft/fazai/models/gemma_converted_sbs')
OUT.mkdir(parents=True, exist_ok=True)

with open(BASE / 'config.json') as f:
    CFG = json.load(f)

NUM_LAYERS = CFG['num_hidden_layers']
MODEL_DIM = CFG['hidden_size']
HEAD_DIM = CFG['head_dim']
NUM_HEADS = CFG['num_attention_heads']
NUM_KV_HEADS = CFG['num_key_value_heads']

with open(BASE / 'model.safetensors.index.json') as f:
    WEIGHT_MAP = json.load(f)['weight_map']


def load_tensor(name: str) -> torch.Tensor:
    shard = WEIGHT_MAP[name]
    with safe_open(BASE / shard, framework='pt') as f:
        return f.get_tensor(name)


def save(name: str, tensor: torch.Tensor):
    np.save(OUT / f'{name}.npy', tensor.detach().to(torch.float32).numpy())


print('Exportando embedding e norm...')
embed = load_tensor('model.embed_tokens.weight')
save('c_embedding', embed[:-64])
final_norm = load_tensor('model.norm.weight')
save('c_final_norm', final_norm)

for layer in range(NUM_LAYERS):
    prefix = f'model.layers.{layer}'
    save(f'pre_att_ns_{layer}', load_tensor(f'{prefix}.input_layernorm.weight'))
    save(f'post_att_ns_{layer}', load_tensor(f'{prefix}.post_attention_layernorm.weight'))
    save(f'pre_ff_ns_{layer}', load_tensor(f'{prefix}.pre_feedforward_layernorm.weight'))
    save(f'post_ff_ns_{layer}', load_tensor(f'{prefix}.post_feedforward_layernorm.weight'))
    save(f'linear_w_{layer}', load_tensor(f'{prefix}.mlp.down_proj.weight'))

    q = load_tensor(f'{prefix}.self_attn.q_proj.weight').reshape(NUM_HEADS, HEAD_DIM, MODEL_DIM)
    k = load_tensor(f'{prefix}.self_attn.k_proj.weight').reshape(NUM_KV_HEADS, HEAD_DIM, MODEL_DIM)
    v = load_tensor(f'{prefix}.self_attn.v_proj.weight').reshape(NUM_KV_HEADS, HEAD_DIM, MODEL_DIM)
    kv = torch.stack([k, v], dim=0).reshape(NUM_KV_HEADS * 2, HEAD_DIM, MODEL_DIM)
    qkv = torch.cat([q, kv], dim=0)
    save(f'qkv_ein_{layer}', qkv)

    att_out = load_tensor(f'{prefix}.self_attn.o_proj.weight').reshape(MODEL_DIM, NUM_HEADS, HEAD_DIM).permute(1, 0, 2)
    save(f'att_ein_{layer}', att_out)

    gate = load_tensor(f'{prefix}.mlp.gate_proj.weight')
    up = load_tensor(f'{prefix}.mlp.up_proj.weight')
    gating = torch.stack([gate, up], dim=0)
    save(f'gating_ein_{layer}', gating)

print('Exportação concluída em', OUT)

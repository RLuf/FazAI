#!/usr/bin/env python3
"""
One-time migration: copy all points from `claudio_soul` to `fazai_memory` in Qdrant.
Reads Qdrant host/port/vector_dim from /etc/fazai/fazai.conf.
Safe to re-run: exits if source collection is missing; creates destination if needed.
"""
import configparser
import sys
import time

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import VectorParams, Distance, PointStruct
except Exception as e:
    print(f"qdrant-client not available: {e}")
    sys.exit(1)

CFG = "/etc/fazai/fazai.conf"
SRC = "claudio_soul"
DST = "fazai_memory"

cfg = configparser.ConfigParser()
cfg.read(CFG)
host = cfg.get("qdrant", "host", fallback="127.0.0.1")
port = cfg.getint("qdrant", "port", fallback=6333)
vdim = cfg.getint("qdrant", "vector_dim", fallback=1024)

client = None
for _ in range(15):
    try:
        client = QdrantClient(host=host, port=port, timeout=5.0)
        client.get_collections()
        break
    except Exception:
        time.sleep(1)
if client is None:
    print("Qdrant unreachable; aborting migration.")
    sys.exit(2)

def exists(name: str) -> bool:
    try:
        client.get_collection(name)
        return True
    except Exception:
        return False

if not exists(SRC):
    print(f"Source collection not found: {SRC}; nothing to migrate.")
    sys.exit(0)

if not exists(DST):
    client.create_collection(
        collection_name=DST,
        vectors_config=VectorParams(size=vdim, distance=Distance.COSINE),
    )

offset = None
total = 0
while True:
    points, offset = client.scroll(
        collection_name=SRC,
        limit=1000,
        with_payload=True,
        with_vectors=True,
        offset=offset,
    )
    if not points:
        break
    upsert = [PointStruct(id=p.id, vector=p.vector, payload=p.payload) for p in points]
    client.upsert(collection_name=DST, points=upsert)
    total += len(upsert)
print(f"Migrated {total} points from {SRC} to {DST}.")


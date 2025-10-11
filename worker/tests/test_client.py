#!/usr/bin/env python3
import socket
import json
import sys
import time

SOCK_PATH = '/run/fazai/gemma.sock'

def send_and_recv(sock, obj, expect_stream=False):
    data = json.dumps(obj) + "\n"
    sock.send(data.encode('utf-8'))
    if not expect_stream:
        resp = sock.recv(8192).decode('utf-8')
        print('RESPONSE:', resp)
        return resp
    else:
        # stream: read lines until we get a type stop or done
        sock.settimeout(5.0)
        try:
            while True:
                chunk = sock.recv(4096).decode('utf-8')
                if not chunk:
                    break
                for line in chunk.split('\n'):
                    if not line.strip():
                        continue
                    try:
                        obj = json.loads(line)
                    except Exception as e:
                        print('BAD JSON:', line)
                        continue
                    print('STREAM:', obj)
                    if obj.get('type') == 'stop' or obj.get('type') == 'done':
                        return
        except socket.timeout:
            print('Stream read timeout')
            return


def main():
    # Espera até o socket existir
    import os
    for i in range(10):
        if os.path.exists(SOCK_PATH):
            break
        print('Aguardando socket...', i)
        time.sleep(0.5)
    else:
        print('Socket não encontrado:', SOCK_PATH)
        sys.exit(1)

    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(SOCK_PATH)

    # create_session
    send_and_recv(sock, {"type":"create_session","params":{}})

    # Para receber session_id precisamos ler a primeira resposta
    # Reconnect simples para separar sessões no teste
    sock.close()
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(SOCK_PATH)

    # generate com prompt
    sid = 'sess_1000000'  # we don't know ID; the server will error if not found
    # Instead, do a create_session and parse
    sock.send(json.dumps({"type":"create_session","params":{}}).encode()+b"\n")
    resp = sock.recv(4096).decode()
    print('CREATE RESP:', resp)
    try:
        respj = json.loads(resp.split('\n')[0])
        sid = respj.get('session_id')
    except Exception:
        print('Falha ao obter session_id')
        sys.exit(1)

    # Generate streaming
    sock.send(json.dumps({"type":"generate","session_id":sid,"prompt":"Configurar relay antispam"}).encode()+b"\n")
    # Ler streaming
    sock.settimeout(10.0)
    try:
        while True:
            chunk = sock.recv(4096).decode('utf-8')
            if not chunk:
                break
            for line in chunk.split('\n'):
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                except Exception as e:
                    print('BAD JSON:', line)
                    continue
                print('STREAM:', obj)
                if obj.get('type') == 'done' or obj.get('type') == 'stop':
                    print('Fim do stream recebido (done/stop)')
                    return
    except socket.timeout:
        print('Timeout na leitura do stream')

if __name__ == '__main__':
    main()

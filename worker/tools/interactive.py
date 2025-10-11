#!/usr/bin/env python3
import socket
import json
import os
import sys

SOCK_PATH = os.environ.get('FAZAI_GEMMA_SOCKET', '/run/fazai/gemma.sock')

class InteractiveClient:
    def __init__(self, sock_path=SOCK_PATH):
        self.sock_path = sock_path
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.sock_path)

    def send(self, obj, expect_stream=False):
        data = json.dumps(obj) + "\n"
        self.sock.send(data.encode('utf-8'))
        if not expect_stream:
            resp = self.sock.recv(8192).decode('utf-8')
            return resp
        else:
            try:
                while True:
                    chunk = self.sock.recv(4096).decode('utf-8')
                    if not chunk:
                        break
                    for line in chunk.split('\n'):
                        if not line.strip():
                            continue
                        try:
                            o = json.loads(line)
                        except Exception:
                            print('BAD JSON:', line)
                            continue
                        yield o
            except Exception as e:
                print('Stream error:', e)
                return

    def interactive(self):
        print('Connected to', self.sock_path)
        while True:
            try:
                cmd = input('fazai> ').strip()
            except EOFError:
                break
            if not cmd:
                continue
            parts = cmd.split(' ',1)
            op = parts[0]
            arg = parts[1] if len(parts)>1 else ''

            if op == 'exit' or op == 'quit':
                break
            if op == 'create':
                resp = self.send({"type":"create_session","params":{}})
                print('RESP:', resp)
                continue
            if op == 'gen':
                prompt = arg or input('Prompt: ')
                for o in self.send({"type":"generate","session_id":arg or '',"prompt":prompt}, expect_stream=True):
                    print('STREAM:', o)
                continue
            if op == 'exec':
                cmdline = arg or input('Command: ')
                for o in self.send({"type":"exec","command":cmdline}, expect_stream=True):
                    print('SHELL:', o)
                continue
            if op == 'status':
                print(self.send({"type":"status"}))
                continue
            print('Unknown command. Use: create, gen, exec, status, quit')

if __name__ == '__main__':
    ic = InteractiveClient()
    ic.interactive()

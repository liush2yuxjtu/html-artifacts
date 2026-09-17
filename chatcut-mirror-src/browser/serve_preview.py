#!/usr/bin/env python3
"""Serve the actual prebuilt static files and their Vercel route configuration."""
import argparse, json, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--port',type=int,default=8768);a=ap.parse_args()
output=Path(a.output).resolve();routes=json.loads((output/'config.json').read_text())['routes']
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(output/'static'),**kwargs)
    def do_GET(self):
        for route in routes:
            if 'src' not in route or not re.match(route['src'],urlsplit(self.path).path):continue
            if route.get('status') in (301,302,307,308):
                self.send_response(route['status'])
                for key,value in route.get('headers',{}).items():self.send_header(key,value)
                self.end_headers();return
            if route.get('dest'):self.path=route['dest'];break
        return super().do_GET()
ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()

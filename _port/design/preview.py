#!/usr/bin/env python3
"""Hand-written (design study): local preview of the design-direction prototypes.
Serves /design/* from _port/design/ (site/ and proto/) and everything else from docs/.
    _port/design/preview.sh [port]     then open http://localhost:<port>/design/
"""
import http.server, os, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
DOCS = HERE.parents[1] / 'docs'
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p.startswith('/design/proto/'): root, rel = HERE / 'proto', p[len('/design/proto/'):]
        elif p.startswith('/design/'): root, rel = HERE / 'site', p[len('/design/'):]
        else: root, rel = DOCS, p.lstrip('/')
        f = (root / rel).resolve()
        if f.is_dir(): f = f / 'index.html'
        return str(f) if str(f).startswith(str(root.resolve())) else str(root / '404')
    def log_message(self, *a): pass
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()
if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    print(f'Design prototypes: http://localhost:{port}/design/   (Ctrl-C to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()

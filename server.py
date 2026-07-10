#!/usr/bin/env python3
"""HTTP server with correct MIME types for JS modules + gzip."""
import http.server
import os
import gzip
from io import BytesIO

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

MIME_TYPES = {
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.css':  'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.wasm': 'application/wasm',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.wav':  'audio/wav',
}

class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME_TYPES.get(ext, super().guess_type(path))

    def end_headers(self):
        # CORS for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        """Serve gzipped content for JS/CSS/HTML."""
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            ext = os.path.splitext(path)[1].lower()
            if ext in ('.js', '.css', '.html', '.json'):
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(self.path))
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-cache')
                # Indicate content length after compression
                with open(path, 'rb') as f:
                    raw = f.read()
                buf = BytesIO()
                with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6) as gz:
                    gz.write(raw)
                compressed = buf.getvalue()
                self.send_header('Content-Length', str(len(compressed)))
                self.end_headers()
                self.wfile.write(compressed)
                return
        # Default handling for other files
        super().do_GET()

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    server = http.server.HTTPServer(('0.0.0.0', PORT), GameHandler)
    print(f'>>> First Fantasy server on http://127.0.0.1:{PORT}')
    print(f'>>> Serving: {DIRECTORY}')
    print(f'>>> JS MIME: application/javascript (fixed!)')
    server.serve_forever()

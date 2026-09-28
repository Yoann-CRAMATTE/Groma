#!/usr/bin/env python3
"""Serveur local pour Groma.

L'API Geolocation exige un contexte sécurisé : un index.html ouvert en file://
est refusé par Chrome. http://localhost est considéré comme sécurisé, d'où ce
serveur minimal. Usage : python3 serveur.py [port]
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
RACINE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RACINE, **kwargs)

    def end_headers(self):
        # Le CSV est réécrit en continu : aucun cache ne doit masquer une modification.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        sys.stdout.write(f"Groma sur http://localhost:{PORT}\n")
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

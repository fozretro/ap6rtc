#!/usr/bin/env python3
"""
CORS-enabled HTTP server for serving ROM files from multiple locations.
This server adds the necessary CORS headers and serves files from their original locations.
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight OPTIONS requests
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        # Handle HEAD requests the same as GET requests
        self.do_GET()

    def do_GET(self):
        # Map ROM files to their actual locations
        rom_mappings = {
            'AP6.rom': 'src.AP6.MDFS/AP6v134t.rom',
            'I2C.rom': 'dist/i2c/I2C32EAP6.rom',
            'LatestAP6.rom': 'dist/ap6.rom',
        }
        
        # Extract filename from path
        path = urlparse(self.path).path.lstrip('/')
        
        if path in rom_mappings:
            target = rom_mappings[path]
            
            if target.startswith('http'):
                # For HTTP URLs, we need to download and serve
                self.send_response(501, "HTTP URLs not supported in this version")
                self.end_headers()
                self.wfile.write(b"HTTP URLs not supported. Please use local files.")
                return
            else:
                # For local files, serve them directly
                # Go up two levels from bin/smjoin/ to project root, then use target path
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                file_path = os.path.join(project_root, target)
                print(f"[DEBUG] Looking for file: {file_path}")
                print(f"[DEBUG] File exists: {os.path.exists(file_path)}")
                
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'rb') as f:
                            content = f.read()
                        
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/octet-stream')
                        self.send_header('Content-Length', str(len(content)))
                        self.end_headers()
                        self.wfile.write(content)
                        return
                    except Exception as e:
                        self.send_response(500, f"Error reading file: {e}")
                        self.end_headers()
                        return
                else:
                    self.send_response(404, f"File not found: {file_path}")
                    self.end_headers()
                    return
        
        # For all other requests, use the default handler
        super().do_GET()

    def log_message(self, format, *args):
        # Custom logging to show CORS requests
        sys.stdout.write(f"[CORS] {self.address_string()} - {format % args}\n")

def main():
    port = 8080
    server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server')
    
    print(f"🚀 Starting CORS-enabled HTTP server...")
    print(f"📁 Serving directory: {server_dir}")
    print(f"🌐 Server URL: http://localhost:{port}")
    print(f"🔧 CORS enabled for all origins (*)")
    print(f"📥 ROM mappings:")
    print(f"   AP6.rom -> Official AP6 ROM (HTTP download needed)")
    print(f"   I2C_standard.rom -> dist/i2c/I2C32EAP6.rom")
    print(f"   distAP6.rom -> dist/ap6.rom")
    print(f"⏹️  Press Ctrl+C to stop the server")
    print("-" * 60)
    
    # Don't change directory - we'll use absolute paths
    
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped by user")
            sys.exit(0)

if __name__ == "__main__":
    main()
import http.server, sys, os
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        super().end_headers()
    def log_message(self, format, *args):
        pass  # suppress logs
if __name__ == '__main__':
    os.chdir(sys.argv[1])
    port = int(sys.argv[2])
    server = http.server.HTTPServer(('127.0.0.1', port), Handler)
    server.serve_forever()

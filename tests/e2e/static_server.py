"""Static file server for the end-to-end tests (a Netlify-like host: no API, no
Server-Timing). `python3 -m http.server` speaks HTTP/1.0 and resets connections
when a page opens many requests at once, so this one keeps connections alive.

    python3 static_server.py <port> <directory>
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port, directory = int(sys.argv[1]), sys.argv[2]
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=directory))
    server.daemon_threads = True
    server.serve_forever()

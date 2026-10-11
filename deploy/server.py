#!/usr/bin/env python3
"""Serve DisPlan build files on loopback, with no directory listings."""

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


class StaticHandler(SimpleHTTPRequestHandler):
    def allowed(self):
        path = unquote(urlsplit(self.path).path)
        relative = "index.html" if path == "/" else path.lstrip("/")
        root = Path(self.directory).resolve()
        candidate = (root / relative).resolve()
        if not candidate.is_relative_to(root) or not candidate.is_file():
            self.send_error(404)
            return False
        return True

    def do_GET(self):
        if self.allowed():
            super().do_GET()

    def do_HEAD(self):
        if self.allowed():
            super().do_HEAD()

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        path = urlsplit(self.path).path
        immutable = (
            path.startswith("/assets/")
            and self.command in {"GET", "HEAD"}
            and Path(self.translate_path(path)).is_file()
        )
        self.send_header(
            "Cache-Control",
            "public, max-age=31536000, immutable" if immutable else "no-cache",
        )
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--port", type=int, default=55432)
    args = parser.parse_args()
    root = args.directory.resolve(strict=True)
    if not (root / "index.html").is_file() or not 1 <= args.port <= 65535:
        parser.error("valid port and directory containing index.html required")
    handler = functools.partial(StaticHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()

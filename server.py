
import os
import sys
import json
import time
import hmac
import hashlib
import base64
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k:
                        os.environ[k] = v

load_env()

def get_credentials():
    load_env()
    creds = {}
    for i in range(1, 10):
        u = os.environ.get(f'USER{i}_NAME', '').strip()
        p = os.environ.get(f'USER{i}_PASS', '').strip()
        if u and p:
            creds[u] = p
    return creds

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
AUTH_SECRET = os.environ.get('AUTH_SECRET', '')

RESPONSE_CACHE = {}
CACHE_TTL = 300

def generate_token(username):
    expires_at = int((time.time() + 3600) * 1000)
    payload_str = json.dumps({'user': username, 'exp': expires_at})
    sig = hmac.new(AUTH_SECRET.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
    token = base64.b64encode(payload_str.encode('utf-8')).decode('utf-8') + '.' + sig
    return token, expires_at

def verify_token(token_str):
    if not token_str or '.' not in token_str:
        return None
    try:
        parts = token_str.split('.')
        if len(parts) != 2:
            return None
        payload_bytes = base64.b64decode(parts[0])
        payload_str = payload_bytes.decode('utf-8')
        expected_sig = hmac.new(AUTH_SECRET.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(parts[1], expected_sig):
            return None
        payload = json.loads(payload_str)
        if time.time() * 1000 > payload.get('exp', 0):
            return None
        return payload
    except Exception:
        return None

class PoseidonDevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = parsed.query

        if path == '/api/supabase' or path == '/.netlify/functions/supabase':
            self.handle_supabase_proxy(query)
            return

        if path == '/api/config' or path == '/.netlify/functions/config':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            resp = {
                'status': 'ready' if SUPABASE_URL and SUPABASE_KEY else 'incomplete',
                'has_supabase_url': bool(SUPABASE_URL),
                'has_supabase_key': bool(SUPABASE_KEY),
                'has_auth_secret': bool(AUTH_SECRET),
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        if path == '/api/data' or path == '/.netlify/functions/data':
            params = urllib.parse.parse_qs(query)
            file_param = params.get('file', [''])[0]
            if not file_param:
                self.send_error_json(400, 'Parameter file wajib disertakan.')
                return
            safe_file = os.path.normpath(file_param).lstrip('\\/').replace('..', '')
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
            full_path = os.path.join(data_dir, safe_file)
            if os.path.exists(full_path) and os.path.isfile(full_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'public, max-age=60')
                self.end_headers()
                with open(full_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error_json(404, f'Berkas {file_param} tidak ditemukan.')
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/login' or path == '/.netlify/functions/login':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body) if body else {}
            except Exception:
                data = {}
            username = (data.get('username') or '').strip()
            password = data.get('password') or ''

            if not username or not password:
                self.send_error_json(400, 'Username dan Password wajib diisi.')
                return

            creds = get_credentials()
            valid_user = None
            if username in creds and password == creds[username]:
                valid_user = username

            if valid_user:
                token, expires_at = generate_token(valid_user)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                resp = {
                    'success': True,
                    'token': token,
                    'user': valid_user,
                    'expiresAt': expires_at,
                    'message': 'Login berhasil.'
                }
                self.wfile.write(json.dumps(resp).encode('utf-8'))
            else:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'Username atau Password salah.'}).encode('utf-8'))
            return

        self.send_error_json(404, 'Endpoint POST tidak ditemukan.')

    def handle_supabase_proxy(self, query):
        if not SUPABASE_URL or not SUPABASE_KEY:
            self.send_error_json(500, 'SUPABASE_URL atau SUPABASE_KEY belum disetel di .env.')
            return

        params = urllib.parse.parse_qs(query)
        table = params.get('table', [''])[0]
        if not table:
            self.send_error_json(400, 'Parameter query ?table=... wajib disertakan.')
            return

        forward_params = {k: v for k, v in params.items() if k != 'table'}
        forward_query_parts = []
        for k, vals in forward_params.items():
            for val in vals:
                forward_query_parts.append(f"{urllib.parse.quote(k)}={urllib.parse.quote(val, safe='.*,:-')}")
        forward_query = '&'.join(forward_query_parts)

        target_url = f"{SUPABASE_URL}/rest/v1/{table}"
        if forward_query:
            target_url += f"?{forward_query}"

        cache_key = target_url
        now = time.time()
        if cache_key in RESPONSE_CACHE:
            cached_data, cached_time = RESPONSE_CACHE[cache_key]
            if now - cached_time < CACHE_TTL:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', f'public, max-age={CACHE_TTL}, s-maxage=300')
                self.send_header('X-Cache', 'HIT')
                self.end_headers()
                self.wfile.write(cached_data)
                return

        try:
            req = urllib.request.Request(
                target_url,
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Accept': 'application/json'
                }
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
                RESPONSE_CACHE[cache_key] = (data, now)
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', f'public, max-age={CACHE_TTL}, s-maxage=300')
                self.send_header('X-Cache', 'MISS')
                self.end_headers()
                self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
        except Exception as e:
            try:
                self.send_error_json(502, f'Gagal proxy ke Supabase: {str(e)}')
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    def send_error_json(self, code, message):
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': message, 'status': code}).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def log_message(self, format, *args):
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} -> {args[1]}\n")

def run(port=8000):
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, PoseidonDevHandler)
    print(f"[*] POSEIDON Web Development Server running at:")
    print(f"    - http://localhost:{port}")
    print(f"    - http://127.0.0.1:{port}")
    print(f"    - Diagnostik: http://localhost:{port}/test_supabase.html")
    print(f"    - Supabase Proxy: http://localhost:{port}/api/supabase?table=...")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down...")
        httpd.server_close()

if __name__ == '__main__':
    p = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        p = int(sys.argv[1])
    elif os.environ.get('PORT') and os.environ.get('PORT').isdigit():
        p = int(os.environ.get('PORT'))
    run(p)

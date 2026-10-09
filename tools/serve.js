/* 검증용 정적 서버: node tools/serve.js [포트=8765]  →  http://localhost:8765  (게임 실행에는 필요 없습니다) */
const http = require('http'), fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), PORT = +process.argv[2] || 8765;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(PORT, () => console.log('http://localhost:' + PORT));

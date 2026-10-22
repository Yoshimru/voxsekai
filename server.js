// Необязательный минимальный сервер для локального просмотра.
// Позже здесь можно добавить API, авторизацию и работу с БД.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        fs.readFile(path.join(root, 'pages', '404.html'), (fallbackErr, page) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fallbackErr ? '404 Not Found' : page);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(process.env.PORT || 3000, () => console.log(`VoxSekai: http://localhost:${process.env.PORT || 3000}`));
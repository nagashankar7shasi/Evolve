const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/test-visual.html';
  const filePath = path.join(__dirname, p);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(8899, () => console.log('listening on 8899'));

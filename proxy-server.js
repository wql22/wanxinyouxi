const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const PORT = 5501;
const SUPABASE_URL = 'https://odcctqmjmcehihruvby.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kY3F0bWpybWNlaGl4aHJ1dmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc5NzAsImV4cCI6MjA5OTUyMzk3MH0.7o4p5lVtca2NqHp7hsqM5QT12imdEFjooCC27VOz6qc';

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// 启动时检测 DNS 连通性
function checkDns() {
    const hostname = url.parse(SUPABASE_URL).hostname;
    console.log(`\n🔍 正在检测 DNS 解析: ${hostname}...`);
    dns.lookup(hostname, (err, address) => {
        if (err) {
            console.error(`❌ DNS 解析失败: ${err.message}`);
            console.error(`   请检查网络连接，或确认 Supabase URL 是否正确`);
            console.error(`   当前配置的 URL: ${SUPABASE_URL}`);
        } else {
            console.log(`✅ DNS 解析成功: ${hostname} → ${address}`);
        }
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 代理 Supabase API 请求
    if (pathname.startsWith('/proxy/')) {
        const targetPath = pathname.replace('/proxy', '');
        const fullPath = targetPath + (parsedUrl.search || '');
        const targetHostname = url.parse(SUPABASE_URL).hostname;
        
        console.log('Proxy:', req.method, fullPath);
        console.log('  → 目标:', targetHostname);
        
        const options = {
            hostname: targetHostname,
            path: fullPath,
            method: req.method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': req.headers['content-type'] || 'application/json',
                'x-client-info': 'supabase-js/2.49.1',
                'Accept': 'application/json',
                'Accept-Profile': 'public',
            }
        };

        // 转发请求体
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (body) {
                options.headers['Content-Length'] = Buffer.byteLength(body);
            }

            const proxyReq = https.request(options, (proxyRes) => {
                let responseBody = '';
                proxyRes.on('data', chunk => responseBody += chunk);
                proxyRes.on('end', () => {
                    console.log('Proxy response:', proxyRes.statusCode, responseBody.slice(0, 300));
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    res.end(responseBody);
                });
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy error:', err.message);
                console.error('  目标主机:', targetHostname);
                console.error('  请检查网络连接和 Supabase URL 配置');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Proxy error: ' + err.message,
                    hint: '无法连接到 Supabase 服务器，请检查网络连接和 URL 配置',
                    target: targetHostname
                }));
            });

            if (body) {
                proxyReq.write(body);
            }
            proxyReq.end();
        });
        return;
    }

    // 测试端点
    if (pathname === '/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'proxy running', time: new Date().toISOString() }));
        return;
    }

    // 静态文件服务
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found: ' + pathname);
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 代理服务器已启动: http://localhost:${PORT}`);
    console.log(`📡 Supabase 代理: http://localhost:${PORT}/proxy/rest/v1/...`);
    console.log(`\n请用浏览器打开: http://localhost:${PORT}`);
    console.log('按 Ctrl+C 停止服务器\n');
    checkDns();
});

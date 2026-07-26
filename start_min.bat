@echo off
cd /d "D:\DEVELOP_wanxinyouxi"
start /min "Node Server" node server.js
timeout /t 3 >nul
start /min "Cloudflare Tunnel" cloudflared.exe tunnel run wanxin

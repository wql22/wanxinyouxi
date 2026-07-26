@echo off
start "晚心游戏-Node" /min cmd /c "cd /d D:\DEVELOP_wanxinyouxi && node server.js"
timeout /t 2 /nobreak >nul
start "晚心游戏-Tunnel" /min cmd /c "cd /d D:\DEVELOP_wanxinyouxi && cloudflared.exe tunnel run wanxin"
echo 晚心游戏服务已启动

@echo off
chcp 65001 >nul
echo [启动中...] 时间: %date% %time% > D:\DEVELOP_wanxinyouxi\server_log.txt

:: 先检查端口占用
echo [检查端口 5501...] >> D:\DEVELOP_wanxinyouxi\server_log.txt
netstat -ano | findstr :5501 >> D:\DEVELOP_wanxinyouxi\server_log.txt 2>&1

:: 启动 Node 服务器（带日志）
echo [启动 Node 服务器...] >> D:\DEVELOP_wanxinyouxi\server_log.txt
start "晚心游戏-Node" cmd /c "cd /d D:\DEVELOP_wanxinyouxi && node server.js >> D:\DEVELOP_wanxinyouxi\server_log.txt 2>&1"

:: 等待2秒
ping 127.0.0.1 -n 3 >nul

:: 检查 node 是否启动成功
echo [检查 Node 进程...] >> D:\DEVELOP_wanxinyouxi\server_log.txt
tasklist | findstr node >> D:\DEVELOP_wanxinyouxi\server_log.txt 2>&1

:: 启动 Cloudflare 隧道
echo [启动 Cloudflare 隧道...] >> D:\DEVELOP_wanxinyouxi\server_log.txt
start "晚心游戏-Tunnel" cmd /c "cd /d D:\DEVELOP_wanxinyouxi && cloudflared.exe tunnel run wanxin >> D:\DEVELOP_wanxinyouxi\server_log.txt 2>&1"

echo [启动命令已执行，请查看 server_log.txt] >> D:\DEVELOP_wanxinyouxi\server_log.txt

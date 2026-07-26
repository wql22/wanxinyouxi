Set WshShell = CreateObject("WScript.Shell")

' 先停止所有相关进程
WshShell.Run "taskkill /F /IM node.exe", 0, True
WshShell.Run "taskkill /F /IM cloudflared.exe", 0, True
WScript.Sleep 2000

' 用 PowerShell Start-Process 可靠启动（后台+日志）
WshShell.Run "powershell -Command ""Start-Process -FilePath 'node' -WorkingDirectory 'D:\DEVELOP_wanxinyouxi' -ArgumentList 'server.js' -WindowStyle Hidden -RedirectStandardOutput 'D:\DEVELOP_wanxinyouxi\server.log'""", 0, False
WScript.Sleep 3000

WshShell.Run "powershell -Command ""Start-Process -FilePath 'D:\DEVELOP_wanxinyouxi\cloudflared.exe' -WorkingDirectory 'D:\DEVELOP_wanxinyouxi' -ArgumentList 'tunnel','run','wanxin' -WindowStyle Hidden -RedirectStandardOutput 'D:\DEVELOP_wanxinyouxi\tunnel.log'""", 0, False

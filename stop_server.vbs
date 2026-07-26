Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "taskkill /F /IM node.exe", 0, True
WshShell.Run "taskkill /F /IM cloudflared.exe", 0, True

$base = "D:\DEVELOP_wanxinyouxi"
$nodePath = "$base\node.exe"
$tunnelPath = "$base\cloudflared.exe"

# 如果本地没有 node.exe，尝试系统 PATH 中的 node
if (-not (Test-Path $nodePath)) {
    $nodePath = "node"
}

# 启动 Node 服务器
$nodeArgs = @{
    FilePath = $nodePath
    ArgumentList = "server.js"
    WorkingDirectory = $base
    WindowStyle = "Hidden"
    PassThru = $true
    RedirectStandardOutput = "$base\server_node.log"
    RedirectStandardError = "$base\server_node_err.log"
}
$node = Start-Process @nodeArgs
"Node PID: $($node.Id)" | Out-File -FilePath "$base\service_status.log" -Encoding utf8

Start-Sleep -Seconds 3

# 启动 Cloudflare 隧道
$tunnelArgs = @{
    FilePath = $tunnelPath
    ArgumentList = @("tunnel","run","wanxin")
    WorkingDirectory = $base
    WindowStyle = "Hidden"
    PassThru = $true
    RedirectStandardOutput = "$base\server_tunnel.log"
    RedirectStandardError = "$base\server_tunnel_err.log"
}
$tunnel = Start-Process @tunnelArgs
"Tunnel PID: $($tunnel.Id)" | Add-Content -Path "$base\service_status.log" -Encoding utf8

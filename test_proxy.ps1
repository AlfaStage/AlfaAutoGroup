$uri = "https://go.evo.labs.alfastage.com.br/instance/create"
$headers = @{
    "apikey" = "awsf4egr5h6ir5neu4wbeav4wtaesbyn5riue64"
    "Content-Type" = "application/json"
}
$body = @{
    instanceName = "TestProxy01"
    name = "TestProxy01"
    qrcode = $true
    proxy = @{
        host = "ice.proxy.labs.alfastage.com.br"
        port = "1080"
        protocol = "socks5"
        username = "icelaser"
        password = "IceL@ser"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    Write-Output "SUCCESS:"
    Write-Output ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Output "ERROR:"
    Write-Output $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errBody = $reader.ReadToEnd()
    Write-Output $errBody
}

$headers = @{
    "Authorization" = "Bearer $env:CEREBRAS_API_KEY"
    "Content-Type" = "application/json"
}

$body = @'
{
  "model": "gpt-oss-120b",
  "messages": [{ "role": "user", "content": "Sag Hallo auf Deutsch" }]
}
'@

Invoke-RestMethod -Uri "https://api.cerebras.ai/v1/chat/completions" -Method Post -Headers $headers -Body $body

$headers = @{
    "Authorization" = "Bearer $env:GROQ_API_KEY"
    "Content-Type" = "application/json"
}

$body = @'
{
  "model": "openai/gpt-oss-120b",
  "messages": [{ "role": "user", "content": "Sag Hallo auf Deutsch" }]
}
'@

Invoke-RestMethod -Uri "https://api.groq.com/openai/v1/chat/completions" -Method Post -Headers $headers -Body $body

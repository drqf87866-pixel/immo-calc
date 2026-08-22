$headers = @{
    "Authorization" = "Bearer $env:GEMINI_API_KEY"
    "Content-Type" = "application/json"
}

$body = @'
{
  "model": "gemini-2.5-flash",
  "messages": [{ "role": "user", "content": "Sag Hallo auf Deutsch" }]
}
'@

Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" -Method Post -Headers $headers -Body $body

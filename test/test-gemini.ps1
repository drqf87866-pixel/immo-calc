$headers = @{
    "Authorization" = "Bearer $env:GEMINI_API_KEY"
    "Content-Type" = "application/json"
}

$body = @'
{
  "model": "gemini-3.5-flash-lite",
  "messages": [{ "role": "user", "content": "Sag Hallo auf Deutsch" }]
}
'@

Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" -Method Post -Headers $headers -Body $body

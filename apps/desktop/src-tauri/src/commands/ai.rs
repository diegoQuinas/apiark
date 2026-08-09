use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateParams {
    pub prompt: String,
    pub context: Option<String>,
    pub api_key: String,
    pub endpoint: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGeneratedRequest {
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub body_type: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGeneratedTests {
    pub tests: String,
    pub assertions: Option<String>,
}

/// Generate an API request from natural language using an OpenAI-compatible API.
#[tauri::command]
pub async fn ai_generate_request(params: AiGenerateParams) -> Result<AiGeneratedRequest, String> {
    let system_prompt = r#"You are an API development assistant. Given a natural language description, generate an HTTP API request.
Respond with a JSON object containing exactly these fields:
- "name": short descriptive name for the request
- "method": HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- "url": full URL with any path parameters as {{variableName}}
- "headers": object of header key-value pairs (include Content-Type if needed)
- "body": request body string (JSON for POST/PUT/PATCH, null for GET/DELETE)
- "bodyType": "json", "form-data", "urlencoded", "raw", or null
- "description": brief description of what the request does

Only respond with the JSON object, no other text."#;

    let mut messages = vec![serde_json::json!({ "role": "system", "content": system_prompt })];

    if let Some(ctx) = &params.context {
        messages.push(serde_json::json!({
            "role": "system",
            "content": format!("Context about the API:\n{ctx}")
        }));
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": params.prompt
    }));

    let url = build_ai_url(&params.endpoint);
    let body = ai_request(
        &url,
        &params.api_key,
        serde_json::json!({
            "model": params.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1000,
        }),
    )
    .await?;

    let content = body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or("Invalid AI response format")?;

    // Parse the JSON from the response (strip markdown code blocks if present)
    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let generated: AiGeneratedRequest = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse generated request: {e}\nRaw: {json_str}"))?;

    Ok(generated)
}

/// Generate test assertions from a request/response pair using an OpenAI-compatible API.
#[tauri::command]
pub async fn ai_generate_tests(
    params: AiGenerateParams,
    request_yaml: String,
    response_body: String,
    response_status: u16,
) -> Result<AiGeneratedTests, String> {
    let system_prompt = r#"You are an API testing assistant. Given an API request and its response, generate test assertions.
Respond with a JSON object containing:
- "tests": JavaScript test code using the ark.test() and ark.expect() API (similar to Chai.js)
- "assertions": YAML assertion block (optional, for declarative assertions)

Example test code:
ark.test("should return 200", () => {
  ark.expect(ark.response.status).to.equal(200);
});
ark.test("should have users array", () => {
  const body = ark.response.json();
  ark.expect(body).to.have.property("users");
  ark.expect(body.users).to.be.an("array");
});

Example YAML assertions:
status: 200
body.users.length: { gt: 0 }
headers.content-type: { contains: "application/json" }
responseTime: { lt: 2000 }

Only respond with the JSON object, no other text."#;

    let user_content = format!(
        "Request:\n```yaml\n{request_yaml}\n```\n\nResponse status: {response_status}\nResponse body:\n```\n{}\n```",
        if response_body.len() > 5000 { &response_body[..5000] } else { &response_body }
    );

    let messages = vec![
        serde_json::json!({ "role": "system", "content": system_prompt }),
        serde_json::json!({ "role": "user", "content": user_content }),
    ];

    let url = build_ai_url(&params.endpoint);
    let body = ai_request(
        &url,
        &params.api_key,
        serde_json::json!({
            "model": params.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1500,
        }),
    )
    .await?;

    let content = body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or("Invalid AI response format")?;

    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    // Try to parse as proper JSON first
    if let Ok(raw) = serde_json::from_str::<serde_json::Value>(json_str) {
        let tests = match raw.get("tests") {
            Some(serde_json::Value::String(s)) => s.clone(),
            Some(serde_json::Value::Array(arr)) => arr
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join("\n"),
            _ => json_str.to_string(),
        };

        let assertions = match raw.get("assertions") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Array(arr)) => Some(
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
            ),
            Some(serde_json::Value::Null) | None => None,
            _ => None,
        };

        return Ok(AiGeneratedTests { tests, assertions });
    }

    // JSON parsing failed — the model likely returned raw JS code
    // wrapped in a JSON-like structure. Extract the test code.
    // Try to pull content between "tests": [ ... ] or just use the raw content.
    let extracted = extract_test_code(json_str);
    Ok(AiGeneratedTests {
        tests: extracted,
        assertions: None,
    })
}

/// Chat response that may optionally contain a generated request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub message: String,
    pub generated_request: Option<AiGeneratedRequest>,
}

/// Chat with the AI assistant. It can answer questions about APIs and also
/// generate HTTP requests when the user asks for one.
#[tauri::command]
pub async fn ai_chat(params: AiGenerateParams) -> Result<AiChatResponse, String> {
    let system_prompt = r#"You are Ark, a friendly and helpful AI assistant inside ApiArk, an API testing tool. You have a warm, approachable personality. Keep your responses concise and clear.

You can do two things:
1. **Chat**: Answer questions about APIs, HTTP, REST, authentication, headers, status codes, debugging, or just have a friendly conversation. Be warm, helpful, and use a casual tone.
2. **Generate requests**: When the user asks you to create, build, or generate an API request, respond with ONLY a JSON object (no other text) containing these fields:
   - "name": short descriptive name for the request
   - "method": HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
   - "url": full URL with any path parameters as {{variableName}}
   - "headers": object of header key-value pairs (include Content-Type if needed)
   - "body": request body string (JSON for POST/PUT/PATCH, null for GET/DELETE)
   - "bodyType": "json", "form-data", "urlencoded", "raw", or null
   - "description": brief description of what the request does

Decide based on the user's message: if they want a request generated, respond with the JSON object only. Otherwise, respond conversationally."#;

    let mut messages = vec![serde_json::json!({ "role": "system", "content": system_prompt })];

    if let Some(ctx) = &params.context {
        messages.push(serde_json::json!({
            "role": "system",
            "content": format!("Context about the API:\n{ctx}")
        }));
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": params.prompt
    }));

    let url = build_ai_url(&params.endpoint);
    let body = ai_request(
        &url,
        &params.api_key,
        serde_json::json!({
            "model": params.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1500,
        }),
    )
    .await?;

    let content = body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or("Invalid AI response format")?;

    // Try to parse as a generated request JSON
    let trimmed = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    if let Ok(generated) = serde_json::from_str::<AiGeneratedRequest>(trimmed) {
        Ok(AiChatResponse {
            message: format!(
                "Generated **{} {}**{}",
                generated.method,
                generated.url,
                generated
                    .description
                    .as_deref()
                    .map(|d| format!("\n{d}"))
                    .unwrap_or_default()
            ),
            generated_request: Some(generated),
        })
    } else {
        Ok(AiChatResponse {
            message: content.to_string(),
            generated_request: None,
        })
    }
}

/// Build the full chat completions URL from the user-configured endpoint.
fn build_ai_url(endpoint: &str) -> String {
    format!("{}/chat/completions", endpoint.trim().trim_end_matches('/'))
}

/// Send a request to the AI provider and return the raw JSON body.
async fn ai_request(
    url: &str,
    api_key: &str,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to reach your AI provider at {url}: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(ai_error_message(status, &body, url));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {e}"))
}

/// Produce a user-friendly error message for common AI API failures.
/// These messages emphasize that the user must supply their own valid API key/endpoint (BYOK).
fn ai_error_message(status: u16, body: &str, url: &str) -> String {
    match status {
        401 => format!("Authentication failed. The API key you provided is invalid or expired. Please update it in Settings → AI. (URL: {url})"),
        403 => format!("Access denied. Your API key may lack permission for the selected model. Please verify your API key and model in Settings → AI. (URL: {url})"),
        404 => format!("Endpoint not found at {url} — please verify the URL in Settings → AI."),
        429 => "Rate limit exceeded on your API provider. Please wait a moment and try again, or check your plan's usage limits.".to_string(),
        _ => format!("Your AI provider returned an error ({status}). Please verify your settings in Settings → AI. (URL: {url}) Details: {body}"),
    }
}

/// Extract test code from a raw AI response that may have invalid JSON wrapping.
/// e.g. `{ "tests": [ ark.test(...), ... ] }` → just the ark.test() blocks.
fn extract_test_code(raw: &str) -> String {
    // Find all ark.test() blocks using simple brace matching
    let mut result = Vec::new();
    let mut search_from = 0;
    while let Some(start) = raw[search_from..].find("ark.test(") {
        let abs_start = search_from + start;
        // Find the matching closing of the ark.test(..., () => { ... })
        // by counting braces from the opening paren
        let mut depth = 0;
        let mut end = abs_start;
        let mut found = false;
        for (i, ch) in raw[abs_start..].char_indices() {
            match ch {
                '(' | '{' => depth += 1,
                ')' | '}' => {
                    depth -= 1;
                    if depth == 0 {
                        end = abs_start + i + 1;
                        found = true;
                        break;
                    }
                }
                _ => {}
            }
        }
        if found {
            // Skip trailing comma/whitespace and grab a semicolon if present
            let block = raw[abs_start..end].trim();
            result.push(format!("{};", block.trim_end_matches(';')));
            search_from = end;
        } else {
            break;
        }
    }

    if result.is_empty() {
        // Couldn't extract blocks — return the raw content stripped of JSON wrapper
        raw.to_string()
    } else {
        result.join("\n\n")
    }
}

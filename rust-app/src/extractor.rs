use base64::{engine::general_purpose::STANDARD, engine::general_purpose::URL_SAFE, Engine as _};
use regex::Regex;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::LazyLock;

static URI_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(?:vmess|vless|trojan|ss|socks|socks5|http|https|hysteria2|hy2|tuic)://[^\s<>\x22\x27`]+").unwrap()
});

pub fn clean_candidate(s: &str) -> String {
    s.trim()
        .trim_matches(|c| matches!(c, '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>' | ',' | ';' | '"' | '\'' | '`'))
        .trim_end_matches(|c| matches!(c, '.' | ',' | '!' | '?' | '，' | '。' | '；'))
        .to_string()
}

pub fn parse_json_candidates(text: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();

    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'{' || bytes[i] == b'[' {
            let slice = &text[i..];
            let mut stream = serde_json::Deserializer::from_str(slice).into_iter::<Value>();
            if let Some(Ok(val)) = stream.next() {
                let offset = stream.byte_offset();
                if let Some(obj) = val.as_object() {
                    let has_proxy_key = obj.contains_key("outbounds")
                        || obj.contains_key("inbounds")
                        || obj.contains_key("outbound")
                        || obj.contains_key("server")
                        || obj.contains_key("proxies");
                    if has_proxy_key {
                        if let Ok(serialized) = serde_json::to_string(&val) {
                            if seen.insert(serialized.clone()) {
                                found.push(serialized);
                            }
                        }
                    }
                }
                i += offset.max(1);
                continue;
            }
        }
        i += 1;
    }
    found
}

fn try_decode_base64_block(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.len() < 24 || trimmed.contains("://") || trimmed.contains(' ') {
        return None;
    }
    let mut padded = trimmed.to_string();
    let rem = padded.len() % 4;
    if rem > 0 {
        padded.push_str(&"=".repeat(4 - rem));
    }
    let bytes = URL_SAFE
        .decode(&padded)
        .or_else(|_| STANDARD.decode(&padded))
        .ok()?;
    let decoded = String::from_utf8(bytes).ok()?;
    if decoded.contains("://") {
        Some(decoded)
    } else {
        None
    }
}

pub fn extract_configs(text: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    // Expand any base64-encoded subscription blocks present in the text
    let mut expanded_text = text.to_string();
    for line in text.lines() {
        if let Some(decoded) = try_decode_base64_block(line) {
            expanded_text.push('\n');
            expanded_text.push_str(&decoded);
        }
    }

    for mat in URI_RE.find_iter(&expanded_text) {
        let cleaned = clean_candidate(mat.as_str());
        if !cleaned.is_empty() && seen.insert(cleaned.clone()) {
            results.push(cleaned);
        }
    }

    let json_items = parse_json_candidates(&expanded_text);
    for item in json_items {
        if seen.insert(item.clone()) {
            results.push(item);
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_uris() {
        let text = "Here are configs: vless://uuid@domain.com:443?security=reality#TestServer and trojan://pass@example.com:443";
        let configs = extract_configs(text);
        assert_eq!(configs.len(), 2);
        assert!(configs[0].starts_with("vless://"));
        assert!(configs[1].starts_with("trojan://"));
    }
}

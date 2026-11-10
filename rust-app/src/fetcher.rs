use crate::extractor::extract_configs;
use base64::{engine::general_purpose::STANDARD, engine::general_purpose::URL_SAFE, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverySource {
    pub name: String,
    pub source_type: SourceType,
    pub target: String,
    pub description: String,
    pub enabled: bool,
    #[serde(default)]
    pub last_count: usize,
    #[serde(default)]
    pub last_status: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SourceType {
    TelegramPublicChannel,
    RawSubscriptionUrl,
    GitHubAggregator,
}

pub fn get_default_sources() -> Vec<DiscoverySource> {
    vec![
        DiscoverySource {
            name: "V2Ray Collector Mix Sub".to_string(),
            source_type: SourceType::RawSubscriptionUrl,
            target: "https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix".to_string(),
            description: "v2rayN compatible multi-protocol subscription".to_string(),
            enabled: true,
            last_count: 0,
            last_status: "Ready".to_string(),
        },
        DiscoverySource {
            name: "Barry-Far V2ray Sub #1".to_string(),
            source_type: SourceType::RawSubscriptionUrl,
            target: "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt".to_string(),
            description: "High-speed VLESS Reality & Trojan subscription (500+ nodes)".to_string(),
            enabled: true,
            last_count: 0,
            last_status: "Ready".to_string(),
        },
        DiscoverySource {
            name: "V2ray Reality Daily (TG)".to_string(),
            source_type: SourceType::TelegramPublicChannel,
            target: "v2rayNG_VPNo".to_string(),
            description: "Telegram channel mirror (@v2rayNG_VPNo)".to_string(),
            enabled: true,
            last_count: 0,
            last_status: "Ready".to_string(),
        },
        DiscoverySource {
            name: "FreeV2rays Public Feed (TG)".to_string(),
            source_type: SourceType::TelegramPublicChannel,
            target: "FreeV2rays".to_string(),
            description: "Telegram channel mirror (@FreeV2rays)".to_string(),
            enabled: true,
            last_count: 0,
            last_status: "Ready".to_string(),
        },
    ]
}

fn try_decode_subscription_body(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("://") {
        return raw.to_string();
    }
    let compact: String = trimmed.chars().filter(|c| !c.is_whitespace()).collect();
    if compact.is_empty() {
        return raw.to_string();
    }
    let mut padded = compact.clone();
    let rem = padded.len() % 4;
    if rem > 0 {
        padded.push_str(&"=".repeat(4 - rem));
    }
    if let Ok(bytes) = STANDARD.decode(&padded).or_else(|_| URL_SAFE.decode(&padded)) {
        if let Ok(decoded_str) = String::from_utf8(bytes) {
            if decoded_str.contains("://") {
                return decoded_str;
            }
        }
    }
    raw.to_string()
}

pub fn classify_source_target(target: &str) -> SourceType {
    let t = target.trim();
    if t.starts_with("http://") || t.starts_with("https://") {
        if t.contains("t.me/") {
            SourceType::TelegramPublicChannel
        } else {
            SourceType::RawSubscriptionUrl
        }
    } else {
        SourceType::TelegramPublicChannel
    }
}

pub async fn fetch_configs_from_source(source: &DiscoverySource) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .user_agent("v2rayN/6.45 (Windows NT 10.0; Win64; x64) Mozilla/5.0")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let url = match source.source_type {
        SourceType::TelegramPublicChannel => {
            let channel = source
                .target
                .trim()
                .trim_start_matches('@')
                .trim_start_matches("https://t.me/s/")
                .trim_start_matches("https://t.me/")
                .trim_end_matches('/');
            format!("https://t.me/s/{channel}")
        }
        SourceType::RawSubscriptionUrl | SourceType::GitHubAggregator => {
            source.target.trim().to_string()
        }
    };

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request error: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {e}"))?;

    let decoded_text = try_decode_subscription_body(&text);
    let configs = extract_configs(&decoded_text);
    Ok(configs)
}

#[derive(Debug, Clone)]
pub struct SubscriptionUpdateResult {
    pub updated_sources: Vec<DiscoverySource>,
    pub all_configs: Vec<String>,
    pub success_subs: usize,
    pub failed_subs: usize,
}

/// Fetches all enabled subscriptions concurrently for fast v2rayN-style batch updates.
pub async fn update_subscriptions_concurrently(
    sources: Vec<DiscoverySource>,
) -> SubscriptionUpdateResult {
    let mut handles = Vec::new();

    for (idx, src) in sources.iter().cloned().enumerate() {
        if !src.enabled {
            continue;
        }
        let handle = tokio::spawn(async move {
            let res = fetch_configs_from_source(&src).await;
            (idx, res)
        });
        handles.push(handle);
    }

    let mut updated_sources = sources;
    let mut all_configs = Vec::new();
    let mut seen = HashSet::new();
    let mut success_subs = 0;
    let mut failed_subs = 0;

    for h in handles {
        if let Ok((idx, res)) = h.await {
            match res {
                Ok(cfgs) => {
                    let count = cfgs.len();
                    if let Some(s) = updated_sources.get_mut(idx) {
                        s.last_count = count;
                        s.last_status = format!("Updated ({count} nodes)");
                    }
                    success_subs += 1;
                    for c in cfgs {
                        if seen.insert(c.clone()) {
                            all_configs.push(c);
                        }
                    }
                }
                Err(err) => {
                    if let Some(s) = updated_sources.get_mut(idx) {
                        s.last_status = format!("Error: {err}");
                    }
                    failed_subs += 1;
                }
            }
        }
    }

    SubscriptionUpdateResult {
        updated_sources,
        all_configs,
        success_subs,
        failed_subs,
    }
}

pub async fn fetch_multiple_sources(sources: &[DiscoverySource]) -> Vec<String> {
    let res = update_subscriptions_concurrently(sources.to_vec()).await;
    res.all_configs
}

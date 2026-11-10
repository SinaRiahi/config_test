use crate::extractor::extract_configs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverySource {
    pub name: String,
    pub source_type: SourceType,
    pub target: String,
    pub description: String,
    pub enabled: bool,
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
            name: "V2ray Reality Daily".to_string(),
            source_type: SourceType::TelegramPublicChannel,
            target: "v2rayNG_VPNo".to_string(),
            description: "Daily updated VLESS Reality and Trojan configurations".to_string(),
            enabled: true,
        },
        DiscoverySource {
            name: "Free V2Ray Public Feed".to_string(),
            source_type: SourceType::TelegramPublicChannel,
            target: "FreeV2rays".to_string(),
            description: "High-speed multi-protocol proxies (VMess/VLESS/HY2)".to_string(),
            enabled: true,
        },
        DiscoverySource {
            name: "GitHub Community V2Ray Collector".to_string(),
            source_type: SourceType::RawSubscriptionUrl,
            target: "https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix".to_string(),
            description: "Aggregated raw public proxy subscription list".to_string(),
            enabled: true,
        },
        DiscoverySource {
            name: "GitHub Daily Reality Sub".to_string(),
            source_type: SourceType::RawSubscriptionUrl,
            target: "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt".to_string(),
            description: "Curated VLESS Reality and Trojan subscription".to_string(),
            enabled: true,
        },
    ]
}

pub async fn fetch_configs_from_source(source: &DiscoverySource) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let url = match source.source_type {
        SourceType::TelegramPublicChannel => {
            let channel = source.target.trim().trim_start_matches('@').trim_start_matches("https://t.me/s/").trim_start_matches("https://t.me/");
            format!("https://t.me/s/{channel}")
        }
        SourceType::RawSubscriptionUrl | SourceType::GitHubAggregator => source.target.clone(),
    };

    let resp = client.get(&url).send().await.map_err(|e| format!("Network request failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Source returned HTTP status {}", resp.status()));
    }

    let text = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;

    // Check if the response is a base64 encoded subscription
    let decoded_text = if !text.contains("://") {
        if let Ok(decoded_bytes) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, text.trim()) {
            String::from_utf8(decoded_bytes).unwrap_or(text.clone())
        } else {
            text
        }
    } else {
        text
    };

    let configs = extract_configs(&decoded_text);
    Ok(configs)
}

pub async fn fetch_multiple_sources(sources: &[DiscoverySource]) -> Vec<String> {
    let mut all_configs = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for src in sources.iter().filter(|s| s.enabled) {
        if let Ok(configs) = fetch_configs_from_source(src).await {
            for cfg in configs {
                if seen.insert(cfg.clone()) {
                    all_configs.push(cfg);
                }
            }
        }
    }

    all_configs
}

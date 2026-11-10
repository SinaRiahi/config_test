use base64::{engine::general_purpose::STANDARD, engine::general_purpose::URL_SAFE, Engine as _};
use serde_json::{json, Value};
use std::collections::HashMap;
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreEngine {
    Xray,
    SingBox,
}

#[derive(Debug, Clone)]
pub struct ParsedOutbound {
    pub outbound: Value,
    pub name: String,
    pub engine: CoreEngine,
}

fn decode_b64(input: &str) -> Result<Vec<u8>, String> {
    let mut s = input.trim().to_string();
    let remainder = s.len() % 4;
    if remainder > 0 {
        s.push_str(&"=".repeat(4 - remainder));
    }
    URL_SAFE
        .decode(&s)
        .or_else(|_| STANDARD.decode(&s))
        .map_err(|e| format!("Base64 decode failed: {e}"))
}

/// Zero-dependency percent decoder for URI fragments and credentials
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

fn parse_query(url: &Url) -> HashMap<String, String> {
    url.query_pairs().into_owned().collect()
}

pub fn uri_to_outbound(uri: &str, tag: &str) -> Result<ParsedOutbound, String> {
    let trimmed = uri.trim();

    // Handle raw JSON configurations directly
    if trimmed.starts_with('{') {
        let val: Value = serde_json::from_str(trimmed).map_err(|e| format!("Invalid JSON config: {e}"))?;
        if let Some(outbounds) = val.get("outbounds").and_then(|v| v.as_array()) {
            if let Some(first) = outbounds.first() {
                let mut out = first.clone();
                if out.get("tag").is_none() {
                    out["tag"] = json!(tag);
                }
                return Ok(ParsedOutbound {
                    outbound: out,
                    name: "JSON Outbound".to_string(),
                    engine: CoreEngine::SingBox,
                });
            }
        }
        let mut out = val;
        if out.get("tag").is_none() {
            out["tag"] = json!(tag);
        }
        return Ok(ParsedOutbound {
            outbound: out,
            name: "JSON Config".to_string(),
            engine: CoreEngine::SingBox,
        });
    }

    let (scheme, rest) = trimmed
        .split_once("://")
        .ok_or_else(|| "Invalid URI scheme".to_string())?;
    let scheme_lower = scheme.to_lowercase();

    let (body, fragment) = match rest.split_once('#') {
        Some((b, f)) => (b, percent_decode(f)),
        None => (rest, scheme_lower.to_uppercase()),
    };

    if scheme_lower == "vmess" {
        let b64_bytes = decode_b64(body)?;
        let json_str = String::from_utf8(b64_bytes).map_err(|e| e.to_string())?;
        let d: Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

        let server = d["add"].as_str().unwrap_or("").to_string();
        if server.is_empty() {
            return Err("VMess config missing server address".to_string());
        }
        let port = d["port"]
            .as_u64()
            .or_else(|| d["port"].as_str().and_then(|p| p.parse().ok()))
            .unwrap_or(443);
        let uuid = d["id"].as_str().unwrap_or("").to_string();
        let alter_id = d["aid"]
            .as_u64()
            .or_else(|| d["aid"].as_str().and_then(|p| p.parse().ok()))
            .unwrap_or(0);
        let security = d["scy"].as_str().unwrap_or("auto");
        let ps_name = d["ps"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or(fragment);

        let mut outbound = json!({
            "type": "vmess",
            "tag": tag,
            "server": server,
            "server_port": port,
            "uuid": uuid,
            "alter_id": alter_id,
            "security": security
        });

        let net = d["net"].as_str().unwrap_or("tcp");
        if net == "ws" {
            let mut ws = json!({ "type": "ws", "path": d["path"].as_str().unwrap_or("") });
            if let Some(host) = d["host"].as_str().filter(|h| !h.is_empty()) {
                ws["headers"] = json!({ "Host": host });
            }
            outbound["transport"] = ws;
        } else if net == "grpc" {
            outbound["transport"] = json!({
                "type": "grpc",
                "service_name": d["path"].as_str().unwrap_or("")
            });
        }

        if d["tls"].as_str() == Some("tls") {
            let sni = d["sni"]
                .as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| d["host"].as_str().filter(|s| !s.is_empty()))
                .unwrap_or(&server);
            outbound["tls"] = json!({
                "enabled": true,
                "server_name": sni
            });
        }

        return Ok(ParsedOutbound {
            outbound,
            name: ps_name,
            engine: CoreEngine::Xray,
        });
    }

    // Special handling for Shadowsocks: supports both Legacy Base64 (ss://BASE64(method:pass@host:port)#tag)
    // and SIP002 (ss://BASE64(method:pass)@host:port#tag)
    if scheme_lower == "ss" {
        let normalized_ss = if !body.contains('@') {
            let decoded = decode_b64(body)?;
            let decoded_str = String::from_utf8(decoded).map_err(|e| e.to_string())?;
            format!("ss://{decoded_str}#{fragment}")
        } else {
            trimmed.to_string()
        };

        let parsed_ss = Url::parse(&normalized_ss).map_err(|e| format!("SS URL parse failed: {e}"))?;
        let host = parsed_ss
            .host_str()
            .ok_or_else(|| "Missing SS host".to_string())?
            .to_string();
        let port = parsed_ss.port().unwrap_or(8388);
        let user = percent_decode(parsed_ss.username());
        let pass_part = parsed_ss.password().map(percent_decode);

        let (method, password) = if let Some(p) = pass_part {
            (user, p)
        } else if let Ok(decoded) = decode_b64(&user) {
            let s = String::from_utf8(decoded).unwrap_or_default();
            if let Some((m, p)) = s.split_once(':') {
                (m.to_string(), p.to_string())
            } else {
                ("aes-128-gcm".to_string(), s)
            }
        } else {
            ("aes-128-gcm".to_string(), user)
        };

        let out = json!({
            "type": "shadowsocks",
            "tag": tag,
            "server": host,
            "server_port": port,
            "method": method,
            "password": password
        });
        return Ok(ParsedOutbound {
            outbound: out,
            name: fragment,
            engine: CoreEngine::Xray,
        });
    }

    let parsed_url = Url::parse(trimmed).map_err(|e| format!("URL parse failed: {e}"))?;
    let q = parse_query(&parsed_url);
    let host = parsed_url
        .host_str()
        .ok_or_else(|| "Missing host".to_string())?
        .to_string();
    let port = parsed_url.port().unwrap_or(443);
    let username = percent_decode(parsed_url.username());
    let password = parsed_url.password().map(percent_decode).unwrap_or_default();

    match scheme_lower.as_str() {
        "vless" => {
            let mut out = json!({
                "type": "vless",
                "tag": tag,
                "server": host,
                "server_port": port,
                "uuid": username
            });
            if let Some(flow) = q.get("flow").filter(|f| !f.is_empty()) {
                out["flow"] = json!(flow);
            }
            let security = q.get("security").map(|s| s.as_str()).unwrap_or("");
            if security == "tls"
                || security == "reality"
                || q.get("tls").map(|v| v == "true" || v == "1").unwrap_or(false)
            {
                let mut tls = json!({ "enabled": true });
                let sni = q
                    .get("sni")
                    .or_else(|| q.get("servername"))
                    .unwrap_or(&host);
                tls["server_name"] = json!(sni);
                if let Some(alpn) = q.get("alpn") {
                    tls["alpn"] = json!(alpn.split(',').collect::<Vec<_>>());
                }
                if security == "reality" {
                    let reality = json!({
                        "enabled": true,
                        "public_key": q.get("pbk").cloned().unwrap_or_default(),
                        "short_id": q.get("sid").cloned().unwrap_or_default()
                    });
                    if let Some(fp) = q.get("fp") {
                        tls["utls"] = json!({ "enabled": true, "fingerprint": fp });
                    }
                    tls["reality"] = reality;
                }
                out["tls"] = tls;
            }

            let net_type = q.get("type").map(|s| s.as_str()).unwrap_or("tcp");
            if net_type == "ws" {
                let mut ws = json!({ "type": "ws", "path": q.get("path").cloned().unwrap_or_default() });
                if let Some(h) = q.get("host") {
                    ws["headers"] = json!({ "Host": h });
                }
                out["transport"] = ws;
            } else if net_type == "grpc" {
                let service = q
                    .get("serviceName")
                    .or_else(|| q.get("service_name"))
                    .cloned()
                    .unwrap_or_default();
                out["transport"] = json!({ "type": "grpc", "service_name": service });
            }

            Ok(ParsedOutbound {
                outbound: out,
                name: fragment,
                engine: CoreEngine::Xray,
            })
        }
        "trojan" => {
            let pass = if !username.is_empty() { username } else { password };
            let mut out = json!({
                "type": "trojan",
                "tag": tag,
                "server": host,
                "server_port": port,
                "password": pass,
                "tls": {
                    "enabled": true,
                    "server_name": q.get("sni").unwrap_or(&host)
                }
            });
            if q.get("type").map(|s| s.as_str()) == Some("ws") {
                let mut ws = json!({ "type": "ws", "path": q.get("path").cloned().unwrap_or_default() });
                if let Some(h) = q.get("host") {
                    ws["headers"] = json!({ "Host": h });
                }
                out["transport"] = ws;
            }
            Ok(ParsedOutbound {
                outbound: out,
                name: fragment,
                engine: CoreEngine::Xray,
            })
        }
        "hysteria2" | "hy2" => {
            let pass = if !username.is_empty() { username } else { password };
            let mut tls = json!({
                "enabled": true,
                "server_name": q.get("sni").unwrap_or(&host)
            });
            if q.get("insecure").map(|v| v == "1" || v == "true").unwrap_or(false) {
                tls["insecure"] = json!(true);
            }
            if let Some(obfs) = q.get("obfs") {
                tls["obfs"] = json!({
                    "type": obfs,
                    "password": q.get("obfs-password").cloned().unwrap_or_default()
                });
            }
            let out = json!({
                "type": "hysteria2",
                "tag": tag,
                "server": host,
                "server_port": port,
                "password": pass,
                "tls": tls
            });
            Ok(ParsedOutbound {
                outbound: out,
                name: fragment,
                engine: CoreEngine::SingBox,
            })
        }
        "tuic" => {
            let out = json!({
                "type": "tuic",
                "tag": tag,
                "server": host,
                "server_port": port,
                "uuid": username,
                "password": password,
                "congestion_control": q.get("congestion_control").cloned().unwrap_or_else(|| "bbr".to_string()),
                "udp_relay_mode": q.get("udp_relay_mode").cloned().unwrap_or_else(|| "native".to_string()),
                "tls": {
                    "enabled": true,
                    "server_name": q.get("sni").unwrap_or(&host)
                }
            });
            Ok(ParsedOutbound {
                outbound: out,
                name: fragment,
                engine: CoreEngine::SingBox,
            })
        }
        "socks" | "socks5" | "http" | "https" => {
            let typ = if scheme_lower.starts_with("socks") { "socks" } else { "http" };
            let mut out = json!({
                "type": typ,
                "tag": tag,
                "server": host,
                "server_port": port
            });
            if !username.is_empty() {
                out["username"] = json!(username);
            }
            if !password.is_empty() {
                out["password"] = json!(password);
            }
            if scheme_lower == "https" {
                out["tls"] = json!({ "enabled": true });
            }
            Ok(ParsedOutbound {
                outbound: out,
                name: fragment,
                engine: CoreEngine::Xray,
            })
        }
        _ => Err(format!("Unsupported protocol scheme: {scheme_lower}")),
    }
}

pub fn make_singbox_config(outbound: &Value, port: u16) -> Value {
    json!({
        "log": { "level": "error" },
        "inbounds": [{
            "type": "mixed",
            "tag": "local-in",
            "listen": "127.0.0.1",
            "listen_port": port
        }],
        "outbounds": [
            outbound,
            { "type": "direct", "tag": "direct" }
        ],
        "route": {
            "final": outbound.get("tag").and_then(|v| v.as_str()).unwrap_or("proxy")
        }
    })
}

pub fn make_xray_config(outbound: &Value, port: u16) -> Result<Value, String> {
    let typ = outbound["type"].as_str().unwrap_or("");
    let server_addr = outbound["server"].as_str().unwrap_or("");
    let server_port = outbound["server_port"].as_u64().unwrap_or(443);

    let mut stream = json!({ "network": "tcp" });

    if let Some(tls) = outbound.get("tls") {
        if tls["enabled"].as_bool().unwrap_or(false) {
            if let Some(reality) = tls.get("reality") {
                if reality["enabled"].as_bool().unwrap_or(false) {
                    stream["security"] = json!("reality");
                    stream["realitySettings"] = json!({
                        "serverName": tls["server_name"].as_str().unwrap_or(""),
                        "publicKey": reality["public_key"].as_str().unwrap_or(""),
                        "shortId": reality["short_id"].as_str().unwrap_or(""),
                        "fingerprint": tls.get("utls").and_then(|u| u["fingerprint"].as_str()).unwrap_or("chrome")
                    });
                }
            } else {
                stream["security"] = json!("tls");
                let mut tls_settings = json!({
                    "serverName": tls["server_name"].as_str().unwrap_or("")
                });
                if let Some(alpn) = tls.get("alpn") {
                    tls_settings["alpn"] = alpn.clone();
                }
                stream["tlsSettings"] = tls_settings;
            }
        }
    }

    if let Some(transport) = outbound.get("transport") {
        if transport["type"].as_str() == Some("ws") {
            stream["network"] = json!("ws");
            stream["wsSettings"] = json!({
                "path": transport["path"].as_str().unwrap_or(""),
                "headers": transport.get("headers").cloned().unwrap_or(json!({}))
            });
        } else if transport["type"].as_str() == Some("grpc") {
            stream["network"] = json!("grpc");
            stream["grpcSettings"] = json!({
                "serviceName": transport["service_name"].as_str().unwrap_or("")
            });
        }
    }

    let settings = match typ {
        "vless" | "vmess" => {
            let mut user = json!({
                "id": outbound["uuid"].as_str().unwrap_or(""),
                "encryption": "none"
            });
            if let Some(flow) = outbound.get("flow") {
                user["flow"] = flow.clone();
            }
            if typ == "vmess" {
                user["alterId"] = json!(outbound["alter_id"].as_u64().unwrap_or(0));
                user["security"] = json!(outbound["security"].as_str().unwrap_or("auto"));
            }
            json!({
                "vnext": [{
                    "address": server_addr,
                    "port": server_port,
                    "users": [user]
                }]
            })
        }
        "trojan" => json!({
            "servers": [{
                "address": server_addr,
                "port": server_port,
                "password": outbound["password"].as_str().unwrap_or("")
            }]
        }),
        "shadowsocks" => json!({
            "servers": [{
                "address": server_addr,
                "port": server_port,
                "method": outbound["method"].as_str().unwrap_or("aes-128-gcm"),
                "password": outbound["password"].as_str().unwrap_or("")
            }]
        }),
        "socks" | "http" => {
            let mut user_list = Vec::new();
            if let Some(u) = outbound.get("username").and_then(|v| v.as_str()) {
                user_list.push(json!({
                    "user": u,
                    "pass": outbound.get("password").and_then(|v| v.as_str()).unwrap_or("")
                }));
            }
            json!({
                "servers": [{
                    "address": server_addr,
                    "port": server_port,
                    "users": user_list
                }]
            })
        }
        _ => return Err(format!("Protocol {typ} requires sing-box core")),
    };

    Ok(json!({
        "log": { "loglevel": "error" },
        "inbounds": [{
            "listen": "127.0.0.1",
            "port": port,
            "protocol": "http",
            "settings": { "allowTransparent": false }
        }],
        "outbounds": [{
            "tag": "proxy",
            "protocol": typ,
            "settings": settings,
            "streamSettings": stream
        }]
    }))
}

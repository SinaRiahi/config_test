import { ParsedConfig, Protocol, DiscoveryFeed } from '../types';

export const SUPPORTED_REGIONS_MAP: Record<string, { name: string; flag: string; supported: boolean }> = {
  US: { name: 'United States', flag: '🇺🇸', supported: true },
  DE: { name: 'Germany', flag: '🇩🇪', supported: true },
  GB: { name: 'United Kingdom', flag: '🇬🇧', supported: true },
  NL: { name: 'Netherlands', flag: '🇳🇱', supported: true },
  SG: { name: 'Singapore', flag: '🇸🇬', supported: true },
  JP: { name: 'Japan', flag: '🇯🇵', supported: true },
  FR: { name: 'France', flag: '🇫🇷', supported: true },
  CA: { name: 'Canada', flag: '🇨🇦', supported: true },
  AU: { name: 'Australia', flag: '🇦🇺', supported: true },
  CH: { name: 'Switzerland', flag: '🇨🇭', supported: true },
  SE: { name: 'Sweden', flag: '🇸🇪', supported: true },
  FI: { name: 'Finland', flag: '🇫🇮', supported: true },
  PL: { name: 'Poland', flag: '🇵🇱', supported: true },
  KR: { name: 'South Korea', flag: '🇰🇷', supported: true },
  TW: { name: 'Taiwan', flag: '🇹🇼', supported: true },
  BR: { name: 'Brazil', flag: '🇧🇷', supported: true },
  IN: { name: 'India', flag: '🇮🇳', supported: true },
  TR: { name: 'Turkey', flag: '🇹🇷', supported: true },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪', supported: true },

  // Blocked / Unsupported territories
  CN: { name: 'China (Mainland)', flag: '🇨🇳', supported: false },
  IR: { name: 'Iran', flag: '🇮🇷', supported: false },
  RU: { name: 'Russia', flag: '🇷🇺', supported: false },
  CU: { name: 'Cuba', flag: '🇨🇺', supported: false },
  KP: { name: 'North Korea', flag: '🇰🇵', supported: false },
  SY: { name: 'Syria', flag: '🇸🇾', supported: false },
};

export const DEFAULT_DISCOVERY_FEEDS: DiscoveryFeed[] = [
  {
    id: 'tg-v2rayng',
    name: 'V2Ray Reality Daily',
    type: 'telegram',
    target: 'v2rayNG_VPNo',
    description: 'High-speed VLESS Reality and Trojan nodes for Telegram users',
    badge: 'Telegram Public',
    enabled: true,
    itemCount: 45,
  },
  {
    id: 'tg-freev2rays',
    name: 'Free V2Rays Public Mirror',
    type: 'telegram',
    target: 'FreeV2rays',
    description: 'Daily community mixed proxy pool (VMess / HY2 / VLESS)',
    badge: 'Telegram Public',
    enabled: true,
    itemCount: 60,
  },
  {
    id: 'gh-barry',
    name: 'GitHub Daily Reality Aggregator',
    type: 'github_sub',
    target: 'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
    description: 'Curated and tested high-speed Reality nodes hosted on GitHub',
    badge: 'GitHub Raw',
    enabled: true,
    itemCount: 80,
  },
  {
    id: 'gh-yebekhe',
    name: 'Community V2Ray Collector',
    type: 'github_sub',
    target: 'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix',
    description: 'Automated multi-source collector updated hourly',
    badge: 'GitHub Raw',
    enabled: true,
    itemCount: 120,
  },
];

export function cleanCandidate(s: string): string {
  return s
    .trim()
    .replace(/^[()[\]{}<>,;\"'`]+/, '')
    .replace(/[()[\]{}<>,;\"'`]+$/, '')
    .replace(/[.,!?，。；]+$/, '');
}

export function decodeB64(str: string): string {
  let s = str.trim();
  const remainder = s.length % 4;
  if (remainder > 0) {
    s += '='.repeat(4 - remainder);
  }
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return atob(s);
  } catch {
    return '';
  }
}

/**
 * O(N) balanced-bracket JSON scanner.
 * Avoids O(N^2) substring JSON.parse loops on large Telegram dumps.
 */
export function parseJsonCandidates(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      const start = i;
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let j = start; j < Math.min(start + 16000, len); j++) {
        const c = text[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\' && inString) {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) {
              end = j + 1;
              break;
            }
          }
        }
      }

      if (end !== -1 && end - start >= 16) {
        const candidate = text.slice(start, end);
        try {
          const parsed = JSON.parse(candidate);
          if (typeof parsed === 'object' && parsed !== null) {
            const hasProxyKey =
              'outbounds' in parsed ||
              'inbounds' in parsed ||
              'outbound' in parsed ||
              'server' in parsed ||
              'proxies' in parsed;
            if (hasProxyKey) {
              const serialized = JSON.stringify(parsed);
              if (!seen.has(serialized)) {
                seen.add(serialized);
                found.push(serialized);
              }
              i = end;
              continue;
            }
          }
        } catch {
          // Not valid JSON, continue scanning
        }
      }
    }
    i++;
  }
  return found;
}

export function extractRawConfigs(text: string): string[] {
  let expandedText = text;

  // Automatically decode any raw Base64 subscription blocks
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= 24 && !trimmed.includes('://') && !trimmed.includes(' ')) {
      const decoded = decodeB64(trimmed);
      if (decoded && decoded.includes('://')) {
        expandedText += '\n' + decoded;
      }
    }
  }

  const uriRegex = /(?:vmess|vless|trojan|ss|socks|socks5|http|https|hysteria2|hy2|tuic):\/\/[^\s<>"'`]+/gi;
  const matches = expandedText.match(uriRegex) || [];
  const cleanedUris = matches.map(cleanCandidate).filter(Boolean);

  const jsonItems = parseJsonCandidates(expandedText);

  const combined = [...cleanedUris, ...jsonItems];
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const item of combined) {
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  return unique;
}

function hashString(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function guessCountryFromRemark(name: string, server: string): { code: string; name: string; flag: string } {
  const lower = `${name} ${server}`.toLowerCase();
  if (lower.includes('usa') || lower.includes('us-') || lower.includes('.us') || lower.includes('america') || lower.includes('sanjose') || lower.includes('chicago')) {
    return { code: 'US', name: 'United States', flag: '🇺🇸' };
  }
  if (lower.includes('germany') || lower.includes('de-') || lower.includes('.de') || lower.includes('frankfurt') || lower.includes('hetzner')) {
    return { code: 'DE', name: 'Germany', flag: '🇩🇪' };
  }
  if (lower.includes('uk') || lower.includes('london') || lower.includes('.gb') || lower.includes('britain')) {
    return { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' };
  }
  if (lower.includes('netherland') || lower.includes('nl-') || lower.includes('.nl') || lower.includes('amsterdam')) {
    return { code: 'NL', name: 'Netherlands', flag: '🇳🇱' };
  }
  if (lower.includes('singapore') || lower.includes('sg-') || lower.includes('.sg')) {
    return { code: 'SG', name: 'Singapore', flag: '🇸🇬' };
  }
  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('jp-') || lower.includes('.jp')) {
    return { code: 'JP', name: 'Japan', flag: '🇯🇵' };
  }
  if (lower.includes('france') || lower.includes('paris') || lower.includes('roubaix') || lower.includes('.fr')) {
    return { code: 'FR', name: 'France', flag: '🇫🇷' };
  }
  if (lower.includes('canada') || lower.includes('toronto') || lower.includes('.ca')) {
    return { code: 'CA', name: 'Canada', flag: '🇨🇦' };
  }
  if (lower.includes('iran') || lower.includes('tehran') || lower.includes('ir-') || lower.includes('.ir')) {
    return { code: 'IR', name: 'Iran (Blocked)', flag: '🇮🇷' };
  }
  if (lower.includes('china') || lower.includes('cn-') || lower.includes('.cn')) {
    return { code: 'CN', name: 'China (Blocked)', flag: '🇨🇳' };
  }
  if (lower.includes('russia') || lower.includes('moscow') || lower.includes('.ru')) {
    return { code: 'RU', name: 'Russia (Blocked)', flag: '🇷🇺' };
  }
  return { code: 'US', name: 'United States', flag: '🇺🇸' };
}

export function parseSingleConfig(raw: string, index: number): ParsedConfig | null {
  try {
    const stableId = `cfg-${hashString(raw)}`;

    if (raw.startsWith('{') || raw.startsWith('[')) {
      const obj = JSON.parse(raw);
      return {
        id: stableId,
        index,
        raw,
        protocol: 'json',
        name: `JSON Config ${index}`,
        server: obj.server || 'custom-json',
        port: Number(obj.server_port || 443),
        countryCode: 'US',
        countryName: 'United States',
        countryFlag: '🇺🇸',
        isSupportedRegion: true,
        recommendedEngine: 'singbox',
        singboxConfig: obj,
      };
    }

    const schemeIdx = raw.indexOf('://');
    if (schemeIdx === -1) return null;
    const scheme = raw.slice(0, schemeIdx);
    const rest = raw.slice(schemeIdx + 3);
    if (!scheme || !rest) return null;
    const protocolLower = scheme.toLowerCase();

    const hashIdx = rest.indexOf('#');
    const body = hashIdx !== -1 ? rest.slice(0, hashIdx) : rest;
    const hashFrag = hashIdx !== -1 ? rest.slice(hashIdx + 1) : '';
    let name = `${protocolLower.toUpperCase()} Server ${index}`;
    if (hashFrag) {
      try {
        name = decodeURIComponent(hashFrag);
      } catch {
        name = hashFrag;
      }
    }

    // 1. VMess Base64 JSON
    if (protocolLower === 'vmess') {
      const decodedJson = decodeB64(body);
      if (!decodedJson) return null;
      const d = JSON.parse(decodedJson);
      const server = d.add || '';
      if (!server) return null;
      const port = Number(d.port || 443);
      const uuid = d.id || '';
      const net = d.net || 'tcp';
      const vmessName = d.ps || name;

      const country = guessCountryFromRemark(vmessName, server);

      const outbound: Record<string, unknown> = {
        type: 'vmess',
        tag: 'proxy',
        server,
        server_port: port,
        uuid,
        alter_id: Number(d.aid || 0),
        security: d.scy || 'auto',
      };

      if (net === 'ws') {
        outbound.transport = {
          type: 'ws',
          path: d.path || '',
          headers: d.host ? { Host: d.host } : undefined,
        };
      } else if (net === 'grpc') {
        outbound.transport = {
          type: 'grpc',
          service_name: d.path || '',
        };
      }

      if (d.tls === 'tls') {
        outbound.tls = {
          enabled: true,
          server_name: d.sni || d.host || server,
        };
      }

      const singbox = {
        log: { level: 'error' },
        inbounds: [{ type: 'mixed', tag: 'local-in', listen: '127.0.0.1', listen_port: 10808 }],
        outbounds: [outbound, { type: 'direct', tag: 'direct' }],
      };

      return {
        id: stableId,
        index,
        raw,
        protocol: 'vmess',
        name: vmessName,
        server,
        port,
        countryCode: country.code,
        countryName: country.name,
        countryFlag: country.flag,
        isSupportedRegion: country.code !== 'IR' && country.code !== 'CN' && country.code !== 'RU',
        uuidOrPassword: uuid,
        security: d.scy || 'auto',
        sni: d.sni || d.host,
        transport: {
          type: net === 'ws' ? 'ws' : net === 'grpc' ? 'grpc' : 'tcp',
          path: d.path,
          host: d.host,
        },
        recommendedEngine: 'xray',
        singboxConfig: singbox,
      };
    }

    // 2. Shadowsocks (both Legacy Base64 ss://BASE64(method:pass@host:port)#tag and SIP002 ss://BASE64(method:pass)@host:port#tag)
    if (protocolLower === 'ss') {
      let normalizedBody = body;
      if (!body.includes('@')) {
        const decoded = decodeB64(body);
        if (decoded && decoded.includes('@')) {
          normalizedBody = decoded;
        }
      }

      const atIdx = normalizedBody.lastIndexOf('@');
      if (atIdx === -1) return null;

      let userInfo = normalizedBody.slice(0, atIdx);
      const hostPortPart = normalizedBody.slice(atIdx + 1).split('?')[0];

      if (!userInfo.includes(':')) {
        const decodedUser = decodeB64(userInfo);
        if (decodedUser) userInfo = decodedUser;
      }

      const colonIdx = userInfo.indexOf(':');
      const method = colonIdx !== -1 ? userInfo.slice(0, colonIdx) : 'aes-128-gcm';
      const password = colonIdx !== -1 ? userInfo.slice(colonIdx + 1) : userInfo;

      const lastColon = hostPortPart.lastIndexOf(':');
      const server = lastColon !== -1 ? hostPortPart.slice(0, lastColon) : hostPortPart;
      const port = lastColon !== -1 ? Number(hostPortPart.slice(lastColon + 1)) || 8388 : 8388;

      const country = guessCountryFromRemark(name, server);
      const outbound = {
        type: 'shadowsocks',
        tag: 'proxy',
        server,
        server_port: port,
        method,
        password,
      };

      const singboxConfig = {
        log: { level: 'error' },
        inbounds: [{ type: 'mixed', tag: 'local-in', listen: '127.0.0.1', listen_port: 10808 }],
        outbounds: [outbound, { type: 'direct', tag: 'direct' }],
      };

      return {
        id: stableId,
        index,
        raw,
        protocol: 'shadowsocks',
        name,
        server,
        port,
        countryCode: country.code,
        countryName: country.name,
        countryFlag: country.flag,
        isSupportedRegion: country.code !== 'IR' && country.code !== 'CN' && country.code !== 'RU',
        uuidOrPassword: `${method}:${password}`,
        security: method,
        recommendedEngine: 'xray',
        singboxConfig,
      };
    }

    // 3. Standard URL-based protocols (VLESS, Trojan, Hysteria2, TUIC, SOCKS, HTTP)
    const url = new URL(
      raw
        .replace(/^hy2:\/\//i, 'https://')
        .replace(/^hysteria2:\/\//i, 'https://')
        .replace(/^tuic:\/\//i, 'https://')
        .replace(/^[a-z0-9]+:\/\//i, 'https://')
    );
    const host = url.hostname;
    if (!host) return null;
    const port = Number(url.port || (protocolLower === 'http' ? 80 : 443));
    const username = decodeURIComponent(url.username || '');
    const password = decodeURIComponent(url.password || '');
    const params = Object.fromEntries(url.searchParams.entries());

    let protocol: Protocol = 'vless';
    if (['vless', 'trojan', 'hysteria2', 'hy2', 'tuic', 'ss', 'socks', 'socks5', 'http', 'https'].includes(protocolLower)) {
      protocol = (
        protocolLower === 'hy2'
          ? 'hysteria2'
          : protocolLower === 'ss'
            ? 'shadowsocks'
            : protocolLower === 'socks5'
              ? 'socks'
              : protocolLower === 'https'
                ? 'http'
                : protocolLower
      ) as Protocol;
    }

    const recommendedEngine: 'xray' | 'singbox' =
      protocol === 'hysteria2' || protocol === 'tuic' ? 'singbox' : 'xray';

    const outbound: Record<string, unknown> = {
      type: protocol,
      tag: 'proxy',
      server: host,
      server_port: port,
    };

    if (protocol === 'vless') {
      outbound.uuid = username;
      if (params.flow) outbound.flow = params.flow;
    } else if (protocol === 'trojan' || protocol === 'hysteria2') {
      outbound.password = username || password;
    } else if (protocol === 'tuic') {
      outbound.uuid = username;
      outbound.password = password;
      outbound.congestion_control = params.congestion_control || 'bbr';
      outbound.udp_relay_mode = params.udp_relay_mode || 'native';
    }

    const security = params.security || '';
    if (security === 'tls' || security === 'reality' || params.tls === '1' || params.tls === 'true') {
      const tls: Record<string, unknown> = { enabled: true };
      const sni = params.sni || params.servername || host;
      tls.server_name = sni;
      if (params.alpn) tls.alpn = params.alpn.split(',');
      if (security === 'reality') {
        tls.reality = {
          enabled: true,
          public_key: params.pbk || '',
          short_id: params.sid || '',
        };
        if (params.fp) tls.utls = { enabled: true, fingerprint: params.fp };
      }
      outbound.tls = tls;
    }

    const netType = params.type || 'tcp';
    if (netType === 'ws') {
      outbound.transport = {
        type: 'ws',
        path: params.path || '',
        headers: params.host ? { Host: params.host } : undefined,
      };
    } else if (netType === 'grpc') {
      outbound.transport = {
        type: 'grpc',
        service_name: params.serviceName || params.service_name || '',
      };
    }

    const singboxConfig = {
      log: { level: 'error' },
      inbounds: [{ type: 'mixed', tag: 'local-in', listen: '127.0.0.1', listen_port: 10808 }],
      outbounds: [outbound, { type: 'direct', tag: 'direct' }],
    };

    const country = guessCountryFromRemark(name, host);

    return {
      id: stableId,
      index,
      raw,
      protocol,
      name,
      server: host,
      port,
      countryCode: country.code,
      countryName: country.name,
      countryFlag: country.flag,
      isSupportedRegion: country.code !== 'IR' && country.code !== 'CN' && country.code !== 'RU',
      uuidOrPassword: username || password,
      security: params.security,
      sni: params.sni || params.servername,
      alpn: params.alpn ? params.alpn.split(',') : undefined,
      reality: params.pbk
        ? {
            publicKey: params.pbk,
            shortId: params.sid || '',
            fingerprint: params.fp,
          }
        : undefined,
      transport: {
        type: netType === 'ws' ? 'ws' : netType === 'grpc' ? 'grpc' : 'tcp',
        path: params.path,
        host: params.host,
        serviceName: params.serviceName || params.service_name,
      },
      recommendedEngine,
      singboxConfig,
    };
  } catch {
    return null;
  }
}

export const SAMPLE_TELEGRAM_MESSAGES = `🔥 Verified AI Studio Ready Configurations from Telegram:

⚡️ Fast US Reality Server (Silicon Valley AI Studio Node):
vless://550e8400-e29b-41d4-a716-446655440000@104.21.67.12:443?security=reality&sni=gateway.icloud.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=6ba7b810&type=grpc&serviceName=speed-grpc#USA-Fast-Reality-AI

🚀 Germany Frankfurt Hysteria 2 (Low Latency Gemini Streaming):
hysteria2://supersecretpass@195.201.24.110:8443?sni=de-cdn.cloudflare.com&insecure=0&obfs=salamander&obfs-password=mysalt#Germany-HY2-UltraSpeed

🛡 Tokyo Japan VMess WebSocket + TLS (Asia-East Region):
vmess://eyJhZGQiOiJqcC10b2t5by5wcm94eS5uZXQiLCJhaWQiOjAsImhvc3QiOiJqcC5jZG4uY29tIiwiaWQiOiI3NGQ1YTM1ZC0xMmE3LTRlZjItYTYzZS04OTNhOTIwNWI2MzIiLCJuZXQiOiJ3cyIsInBhdGgiOiIvdjJyYXktd3MiLCJwb3J0Ijo0NDMsInBzIjoiVG9reW8tV1MtVExTIiwic2N5IjoiYXV0byIsInNuaSI6ImpwLmNkbi5jb20iLCJ0bHMiOiJ0bHMifQ==

🔒 Amsterdam Netherlands Trojan (Europe AI Studio Friendly):
trojan://StrongTrojanPassword99@185.190.140.22:443?security=tls&sni=nl-telecom.net&type=ws&path=%2Ftrojan-ws#Netherlands-Trojan-Uncapped

🌐 Singapore TUIC v5 (Asia-Southeast Gemini API Node):
tuic://8f3c1a2e-4b5c-4d3e-9f0a-1b2c3d4e5f6a:secretpass123@139.180.201.88:8443?congestion_control=bbr&udp_relay_mode=native&sni=sg-api.aws.com#Singapore-TUIC-v5

⚡️ London UK Shadowsocks SIP002:
ss://YWVzLTEyOC1nY206cGFzc3dvcmRAMTg1LjI0Ni4xMzAuOTU6ODgwMA==#London-Shadowsocks-Fast

⚠️ Unsupported Region Node (Example for Geo-Fence Detection):
vless://11111111-2222-3333-4444-555555555555@185.143.232.10:443?security=tls&sni=tehran-cdn.ir#Iran-Tehran-Blocked-Region
`;

export const DISCOVERY_MOCK_CONFIGS: Record<string, string[]> = {
  'v2rayNG_VPNo': [
    'vless://6f9b1c2e-4b5c-4d3e-9f0a-1b2c3d4e5f6a@142.250.190.46:443?security=reality&sni=www.yahoo.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=6ba7b810#USA-SanJose-GoogleAI',
    'trojan://pass1234@185.220.101.5:443?security=tls&sni=fr-core.ovh.net#France-Roubaix-Fast',
    'hysteria2://password999@195.154.122.33:8443?sni=de-speed.hetzner.com#Germany-Hetzner-HY2',
  ],
  'FreeV2rays': [
    'vmess://eyJhZGQiOiJ1cy1jaGljYWdvLnByb3h5Lm5ldCIsImFpZCI6MCwiaG9zdCI6InVzLmNkb24uY29tIiwiaWQiOiI3NGQ1YTM1ZC0xMmE3LTRlZjItYTYzZS04OTNhOTIwNWI2MzIiLCJuZXQiOiJ3cyIsInBhdGgiOiIvdjJyYXktd3MiLCJwb3J0Ijo0NDMsInBzIjoiVVNBLUNoaWNhZ28tV1MiLCJzY3kiOiJhdXRvIiwic25pIjoidXMuY2Rvbi5jb20iLCJ0bHMiOiJ0bHMifQ==',
    'vless://a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d@139.59.210.45:443?security=reality&sni=sg-edge.cloudflare.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=12345678#Singapore-FastNode',
  ],
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt': [
    'vless://550e8400-e29b-41d4-a716-446655440000@104.21.67.12:443?security=reality&sni=gateway.icloud.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=6ba7b810#USA-GitHub-Curated-01',
    'trojan://StrongTrojanPassword99@185.190.140.22:443?security=tls&sni=nl-telecom.net#Netherlands-GitHub-02',
    'tuic://8f3c1a2e-4b5c-4d3e-9f0a-1b2c3d4e5f6a:secretpass123@139.180.201.88:8443?congestion_control=bbr&udp_relay_mode=native&sni=sg-api.aws.com#Singapore-TUIC-03',
  ],
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix': [
    'vless://bbbbbbbb-cccc-dddd-eeee-ffffffffffff@198.51.100.22:443?security=reality&sni=itunes.apple.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=99887766#Canada-Toronto-AI',
    'hysteria2://superpass@188.166.240.11:8443?sni=amsterdam.digitalocean.com#Netherlands-HY2-Stream',
  ],
};

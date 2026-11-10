import { ParsedConfig, Protocol } from '../types';

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
  // Replace url safe chars
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return atob(s);
  } catch {
    return '';
  }
}

export function parseJsonCandidates(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const jsonRegex = /[{\[]/g;
  let match: RegExpExecArray | null;

  while ((match = jsonRegex.exec(text)) !== null) {
    const start = match.index;
    for (let len = 20; len < Math.min(text.length - start, 8000); len++) {
      const slice = text.slice(start, start + len);
      if (slice.endsWith('}') || slice.endsWith(']')) {
        try {
          const parsed = JSON.parse(slice);
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
              break;
            }
          }
        } catch {
          // keep searching
        }
      }
    }
  }
  return found;
}

export function extractRawConfigs(text: string): string[] {
  const uriRegex = /(?:vmess|vless|trojan|ss|socks|socks5|http|https|hysteria2|hy2|tuic):\/\/[^\s<>"'`]+/gi;
  const matches = text.match(uriRegex) || [];
  const cleanedUris = matches.map(cleanCandidate).filter(Boolean);

  const jsonItems = parseJsonCandidates(text);

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

export function parseSingleConfig(raw: string, index: number): ParsedConfig | null {
  try {
    // Check if JSON
    if (raw.startsWith('{') || raw.startsWith('[')) {
      const obj = JSON.parse(raw);
      return {
        id: `cfg-${index}-${Math.random().toString(36).slice(2, 7)}`,
        index,
        raw,
        protocol: 'json',
        name: `JSON Config ${index}`,
        server: obj.server || 'custom-json',
        port: Number(obj.server_port || 443),
        recommendedEngine: 'singbox',
        singboxConfig: obj,
      };
    }

    const [scheme, rest] = raw.split('://');
    if (!scheme || !rest) return null;
    const protocolLower = scheme.toLowerCase();

    const [body, hashFrag] = rest.split('#');
    const name = hashFrag ? decodeURIComponent(hashFrag) : `${protocolLower.toUpperCase()} Server ${index}`;

    if (protocolLower === 'vmess') {
      const decodedJson = decodeB64(body);
      if (!decodedJson) return null;
      const d = JSON.parse(decodedJson);
      const server = d.add || '';
      const port = Number(d.port || 443);
      const uuid = d.id || '';
      const net = d.net || 'tcp';

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
        id: `cfg-${index}-${Math.random().toString(36).slice(2, 7)}`,
        index,
        raw,
        protocol: 'vmess',
        name,
        server,
        port,
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

    const url = new URL(raw.replace(/^hy2:\/\//i, 'https://').replace(/^hysteria2:\/\//i, 'https://').replace(/^tuic:\/\//i, 'https://').replace(/^[a-z0-9]+:\/\//i, 'https://'));
    const host = url.hostname;
    const port = Number(url.port || (protocolLower === 'http' ? 80 : 443));
    const username = decodeURIComponent(url.username || '');
    const password = decodeURIComponent(url.password || '');
    const params = Object.fromEntries(url.searchParams.entries());

    let protocol: Protocol = 'vless';
    if (['vless', 'trojan', 'hysteria2', 'hy2', 'tuic', 'ss', 'socks', 'socks5', 'http', 'https'].includes(protocolLower)) {
      protocol = (protocolLower === 'hy2' ? 'hysteria2' : protocolLower) as Protocol;
    }

    let recommendedEngine: 'xray' | 'singbox' = 'xray';
    if (protocol === 'hysteria2' || protocol === 'tuic') {
      recommendedEngine = 'singbox';
    }

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

    return {
      id: `cfg-${index}-${Math.random().toString(36).slice(2, 7)}`,
      index,
      raw,
      protocol,
      name,
      server: host,
      port,
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

export const SAMPLE_TELEGRAM_MESSAGES = `🔥 Daily High Speed Shadowsocks & VLESS Reality Configs for Telegram users:

⚡️ Fast US Server with Reality:
vless://550e8400-e29b-41d4-a716-446655440000@104.21.67.12:443?security=reality&sni=gateway.icloud.com&fp=chrome&pbk=GzH45Lq-Xwz2F6ZqR8-L1T88U67Q7aV_0rZ5w1p2k&sid=6ba7b810&type=grpc&serviceName=speed-grpc#USA-Fast-Reality-AI

🚀 Germany Hysteria 2 (BBR Enabled):
hysteria2://supersecretpass@195.201.24.110:8443?sni=de-cdn.cloudflare.com&insecure=0&obfs=salamander&obfs-password=mysalt#Germany-HY2-UltraSpeed

🛡 Tokyo VMess WebSocket + TLS:
vmess://eyJhZGQiOiJqcC10b2t5by5wcm94eS5uZXQiLCJhaWQiOjAsImhvc3QiOiJqcC5jZG4uY29tIiwiaWQiOiI3NGQ1YTM1ZC0xMmE3LTRlZjItYTYzZS04OTNhOTIwNWI2MzIiLCJuZXQiOiJ3cyIsInBhdGgiOiIvdjJyYXktd3MiLCJwb3J0Ijo0NDMsInBzIjoiVG9reW8tV1MtVExTIiwic2N5IjoiYXV0byIsInNuaSI6ImpwLmNkbi5jb20iLCJ0bHMiOiJ0bHMifQ==

🔒 Amsterdam Trojan:
trojan://StrongTrojanPassword99@185.190.140.22:443?security=tls&sni=nl-telecom.net&type=ws&path=%2Ftrojan-ws#Netherlands-Trojan-Uncapped

🌐 Singapore TUIC v5:
tuic://8f3c1a2e-4b5c-4d3e-9f0a-1b2c3d4e5f6a:secretpass123@139.180.201.88:8443?congestion_control=bbr&udp_relay_mode=native&sni=sg-api.aws.com#Singapore-TUIC-v5

⚡️ UK Shadowsocks SIP002:
ss://YWVzLTEyOC1nY206cGFzc3dvcmRAMTg1LjI0Ni4xMzAuOTU6ODgwMA==#London-Shadowsocks-Fast

Enjoy high speed connections! Tested for Google AI Studio & Claude!
`;

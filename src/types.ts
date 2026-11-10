export type Protocol =
  | 'vmess'
  | 'vless'
  | 'trojan'
  | 'hysteria2'
  | 'tuic'
  | 'shadowsocks'
  | 'socks'
  | 'http'
  | 'json';

export type AiStudioVerificationStatus =
  | 'untested'
  | 'testing'
  | 'working'        // Country supported + AI Studio HTTP 200 + Gemini API OK
  | 'region_blocked' // Egress IP in unsupported country or AI Studio geo-block notice
  | 'api_blocked'    // AI Studio web loads but Gemini API gateway rejects request
  | 'failed';        // Proxy connection failed or timed out

export interface ParsedConfig {
  id: string;
  index: number;
  raw: string;
  protocol: Protocol;
  name: string;
  server: string;
  port: number;
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
  isSupportedRegion?: boolean;
  uuidOrPassword?: string;
  security?: string;
  sni?: string;
  alpn?: string[];
  transport?: {
    type: 'tcp' | 'ws' | 'grpc';
    path?: string;
    host?: string;
    serviceName?: string;
  };
  reality?: {
    publicKey: string;
    shortId: string;
    fingerprint?: string;
  };
  obfs?: {
    type: string;
    password?: string;
  };
  congestionControl?: string;
  udpRelayMode?: string;
  recommendedEngine: 'xray' | 'singbox';
  singboxConfig: Record<string, unknown>;
  xrayConfig?: Record<string, unknown>;

  // Verification results
  testStatus?: AiStudioVerificationStatus;
  delayMs?: number;
  testDetail?: string;
  webStatus?: number;
  apiAccessible?: boolean;
}

export interface DiscoveryFeed {
  id: string;
  name: string;
  type: 'telegram' | 'github_sub' | 'custom';
  target: string;
  description: string;
  badge: string;
  enabled: boolean;
  itemCount?: number;
}

export interface RustSourceFile {
  path: string;
  filename: string;
  description: string;
  code: string;
}

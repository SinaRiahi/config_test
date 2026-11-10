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

export interface ParsedConfig {
  id: string;
  index: number;
  raw: string;
  protocol: Protocol;
  name: string;
  server: string;
  port: number;
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
  testStatus?: 'idle' | 'testing' | 'working' | 'failed';
  delayMs?: number;
  testDetail?: string;
}

export interface RustSourceFile {
  path: string;
  filename: string;
  description: string;
  code: string;
}

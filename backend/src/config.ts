import dotenv from 'dotenv';

dotenv.config();

function read(name: string): string {
  return process.env[name]?.trim() || '';
}

/** Render et Railway ne doivent jamais ouvrir de connexion PostgreSQL. */
export function isCloudHost(): boolean {
  return process.env.RENDER === 'true' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

export const config = {
  get port(): number {
    return parseInt(process.env.PORT || '5000', 10);
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get jwtSecret(): string {
    const secret = read('JWT_SECRET');
    if (secret) return secret;
    if (this.nodeEnv === 'production' || isCloudHost()) return '';
    return 'dev_only_jwt_secret_change_me';
  },
  get jwtExpiresIn(): string {
    return read('JWT_EXPIRES_IN') || '24h';
  },
  /** URL HTTPS du tunnel Cloudflare vers la passerelle. GATEWAY_URL reste accepté. */
  get localGatewayUrl(): string {
    return (read('LOCAL_GATEWAY_URL') || read('GATEWAY_URL')).replace(/\/$/, '');
  },
  /** Secret partagé avec la passerelle. Jamais exposé au frontend. GATEWAY_SECRET reste accepté. */
  get localGatewayToken(): string {
    return read('LOCAL_GATEWAY_TOKEN') || read('GATEWAY_SECRET');
  },
  get frontendUrl(): string {
    return read('FRONTEND_URL') || '*';
  },
  get gatewayTimeoutMs(): number {
    return parseInt(process.env.GATEWAY_TIMEOUT_MS || '8000', 10);
  },
  db: {
    get host(): string {
      return read('DB_HOST') || '127.0.0.1';
    },
    get port(): number {
      return parseInt(process.env.DB_PORT || '5432', 10);
    },
    get database(): string {
      return read('DB_NAME');
    },
    get user(): string {
      return read('DB_USER');
    },
    get password(): string {
      return process.env.DB_PASSWORD ?? '';
    },
    get ssl(): boolean {
      return read('DB_SSL') === 'true';
    },
    get connectionTimeoutMs(): number {
      return parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10);
    },
  },
};

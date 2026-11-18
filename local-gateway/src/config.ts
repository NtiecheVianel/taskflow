import dotenv from 'dotenv';

dotenv.config();

function read(name: string): string {
  return process.env[name]?.trim() || '';
}

export const config = {
  get port(): number {
    return parseInt(process.env.PORT || '4000', 10);
  },
  get host(): string {
    return read('HOST') || '127.0.0.1';
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get localGatewayToken(): string {
    return read('LOCAL_GATEWAY_TOKEN');
  },
  get rateLimitWindowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  },
  get rateLimitMax(): number {
    return parseInt(process.env.RATE_LIMIT_MAX || '300', 10);
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

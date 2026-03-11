import { normalizePrismaDatabaseUrl } from '../src/infrastructure/prisma/prisma.service';

describe('normalizePrismaDatabaseUrl', () => {
  it('adds safe pool parameters when missing', () => {
    const normalized = normalizePrismaDatabaseUrl(
      'postgresql://user:pass@host:5432/db?sslmode=require',
      {
        connectionLimit: 1,
        poolTimeoutSeconds: 20,
      },
    );

    expect(normalized).toContain('sslmode=require');
    expect(normalized).toContain('connection_limit=1');
    expect(normalized).toContain('pool_timeout=20');
  });

  it('preserves explicit connection parameters', () => {
    const normalized = normalizePrismaDatabaseUrl(
      'postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=7',
      {
        connectionLimit: 1,
        poolTimeoutSeconds: 20,
      },
    );

    expect(normalized).toContain('connection_limit=5');
    expect(normalized).toContain('pool_timeout=7');
  });

  it('returns non-postgres urls unchanged', () => {
    const url = 'file:dev.db';
    expect(normalizePrismaDatabaseUrl(url)).toBe(url);
  });
});

import type { AaValidationResponse, ReportBatchResponse } from '@japanese-learn/shared';

const BASE = '/v1';
const ADMIN_KEY_STORAGE_KEY = 'admin_api_key_record';
const LEGACY_ADMIN_KEY_STORAGE_KEY = 'admin_api_key';

interface StoredAdminKeyRecord {
  value: string;
  savedAt: string;
  lastUsedAt?: string;
}

export interface AdminKeySnapshot {
  hasKey: boolean;
  value: string | null;
  maskedValue: string | null;
  savedAt: string | null;
  lastUsedAt: string | null;
}

export class AdminApiError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.path = path;
  }
}

function isStoredAdminKeyRecord(value: unknown): value is StoredAdminKeyRecord {
  return Boolean(
    value
      && typeof value === 'object'
      && typeof (value as StoredAdminKeyRecord).value === 'string'
      && typeof (value as StoredAdminKeyRecord).savedAt === 'string'
  );
}

function parseStoredAdminKey(raw: string | null): StoredAdminKeyRecord | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredAdminKeyRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistAdminKey(record: StoredAdminKeyRecord | null) {
  if (!record) {
    localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ADMIN_KEY_STORAGE_KEY, JSON.stringify(record));
  localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE_KEY);
}

function loadStoredAdminKey(): StoredAdminKeyRecord | null {
  const current = parseStoredAdminKey(localStorage.getItem(ADMIN_KEY_STORAGE_KEY));
  if (current) return current;

  const legacy = localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE_KEY);
  if (!legacy) return null;

  const migrated: StoredAdminKeyRecord = {
    value: legacy,
    savedAt: new Date().toISOString(),
  };
  persistAdminKey(migrated);
  return migrated;
}

function maskAdminKey(adminKey: string): string {
  if (adminKey.length <= 4) {
    return '*'.repeat(adminKey.length);
  }

  if (adminKey.length <= 8) {
    return `${adminKey.slice(0, 2)}${'*'.repeat(adminKey.length - 4)}${adminKey.slice(-2)}`;
  }

  return `${adminKey.slice(0, 4)}${'*'.repeat(Math.max(4, adminKey.length - 8))}${adminKey.slice(-4)}`;
}

function touchAdminKeyUsage() {
  const current = loadStoredAdminKey();
  if (!current) return;

  persistAdminKey({
    ...current,
    lastUsedAt: new Date().toISOString(),
  });
}

export function getAdminKey(): string | null {
  return loadStoredAdminKey()?.value ?? null;
}

export function getAdminKeySnapshot(): AdminKeySnapshot {
  const current = loadStoredAdminKey();

  return {
    hasKey: Boolean(current?.value),
    value: current?.value ?? null,
    maskedValue: current?.value ? maskAdminKey(current.value) : null,
    savedAt: current?.savedAt ?? null,
    lastUsedAt: current?.lastUsedAt ?? null,
  };
}

export function setAdminKey(adminKey: string) {
  persistAdminKey({
    value: adminKey,
    savedAt: new Date().toISOString(),
  });
}

export function clearAdminKey() {
  persistAdminKey(null);
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new AdminApiError('No saved Admin API key. Save a key before running admin actions.', 0, path);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error || res.statusText;

    if (res.status === 403) {
      throw new AdminApiError('Admin API key was rejected. Check the saved key and server configuration.', 403, path);
    }

    throw new AdminApiError(message, res.status, path);
  }

  touchAdminKeyUsage();
  return res.json() as Promise<T>;
}

export async function fetchAaValidation(expId: string): Promise<AaValidationResponse> {
  return adminRequest<AaValidationResponse>(`/experiments/aa-validate?exp_id=${encodeURIComponent(expId)}`);
}

export async function runReportBatch(): Promise<ReportBatchResponse> {
  return adminRequest<ReportBatchResponse>('/report/batch', { method: 'POST' });
}

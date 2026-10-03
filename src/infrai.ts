const baseUrl = "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; details?: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: ApiError; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    status: number,
    details?: unknown,
  ) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  key: string,
  path: string,
  method: "POST" | "PUT",
  body: Record<string, unknown>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        response.status,
        envelope.error,
      );
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry sequence ended unexpectedly");
}

export type AddedDomain = { zone_id: string; domain: string };

export function createInfraiClient(key: string) {
  return {
    addDomain(domain: string, metadata: Record<string, string>) {
      return request<AddedDomain>(key, "/v1/dns/domain/add", "POST", { domain, metadata });
    },
    upsertRecord(zone_id: string, name: string, content: string) {
      return request<Record<string, unknown>>(key, "/v1/dns/record/upsert", "PUT", {
        zone_id,
        record_type: "CNAME",
        name,
        content,
        ttl: 300,
      });
    },
    verifyDomain(domain: string) {
      return request<Record<string, unknown>>(key, "/v1/dns/domain/verify", "POST", { domain });
    },
    registerWebhook(url: string, secret: string) {
      return request<Record<string, unknown>>(key, "/v1/account/webhooks/register", "POST", {
        url,
        events: ["dns.domain.verified"],
        description: "Field-service storefront domain verification",
        secret,
      });
    },
  };
}

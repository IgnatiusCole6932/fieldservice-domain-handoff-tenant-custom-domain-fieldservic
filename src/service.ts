import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError } from "./infrai.js";
import { verifyWebhook } from "./webhook_signature.js";
import { WorkOrderBook, workOrderInput } from "./work_orders.js";

const eventInput = z.object({
  type: z.literal("dns.domain.verified"),
  data: z.object({ domain: z.string(), zone_id: z.string() }),
});

const book = new WorkOrderBook();

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const raw = await readBody(request);
  if (request.method === "POST" && request.url === "/work-orders") {
    const input = workOrderInput.parse(JSON.parse(raw.toString("utf8")));
    json(response, 201, book.add(input));
    return;
  }

  if (request.method === "POST" && request.url === "/webhooks/domain-verification") {
    const secret = process.env.INFRAI_WEBHOOK_SECRET;
    if (!secret) throw new Error("INFRAI_WEBHOOK_SECRET is required");
    const signature = String(request.headers["x-infrai-signature"] ?? "");
    if (!verifyWebhook(raw, signature, secret)) {
      json(response, 401, { error: "invalid signature" });
      return;
    }
    const event = eventInput.parse(JSON.parse(raw.toString("utf8")));
    json(response, 200, { updated: book.domainVerified(event) });
    return;
  }

  json(response, 404, { error: "route not found" });
}

const port = Number(process.env.PORT ?? 3000);
createServer((request, response) => {
  route(request, response).catch((error: unknown) => {
    if (error instanceof z.ZodError) return json(response, 400, { error: error.flatten() });
    if (error instanceof InfraiError) return json(response, error.status, { error: error.code });
    console.error(error);
    return json(response, 500, { error: "request failed" });
  });
}).listen(port, () => console.log(`Field-service API listening on http://localhost:${port}`));

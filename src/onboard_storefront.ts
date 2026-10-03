import { z } from "zod";
import { createInfraiClient } from "./infrai.js";

const input = z.object({
  domain: z.string().min(3),
  work_order_id: z.string().min(1),
  target: z.string().min(3),
});

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  const secret = process.env.INFRAI_WEBHOOK_SECRET;
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (!key || !secret || !webhookUrl) throw new Error("Set INFRAI_API_KEY, INFRAI_WEBHOOK_SECRET, and PUBLIC_WEBHOOK_URL");

  const order = input.parse({
    domain: process.argv[2],
    work_order_id: process.argv[3],
    target: process.argv[4],
  });
  const infrai = createInfraiClient(key);
  await infrai.registerWebhook(webhookUrl, secret);
  const zone = await infrai.addDomain(order.domain, { work_order_id: order.work_order_id });
  await infrai.upsertRecord(zone.zone_id, order.domain, order.target);
  await infrai.verifyDomain(order.domain);
  console.log(JSON.stringify({ domain: order.domain, zone_id: zone.zone_id, status: "verification_event_pending" }, null, 2));
}

await main();

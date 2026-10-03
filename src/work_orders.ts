import { z } from "zod";

export const workOrderInput = z.object({
  id: z.string().min(1),
  customer_domain: z.string().min(3),
  photo_urls: z.array(z.string().url()).min(1),
  technician_follow_up: z.string().min(1),
});

export type WorkOrder = z.infer<typeof workOrderInput> & {
  dispatch_status: "waiting_for_domain" | "ready_to_dispatch";
};

export type DomainVerifiedEvent = {
  type: "dns.domain.verified";
  data: { domain: string; zone_id: string };
};

export function applyDomainVerified(order: WorkOrder, event: DomainVerifiedEvent): WorkOrder {
  if (order.customer_domain !== event.data.domain) return order;
  return { ...order, dispatch_status: "ready_to_dispatch" };
}

export class WorkOrderBook {
  private readonly orders = new Map<string, WorkOrder>();

  add(input: z.infer<typeof workOrderInput>): WorkOrder {
    const order = { ...input, dispatch_status: "waiting_for_domain" as const };
    this.orders.set(order.id, order);
    return order;
  }

  domainVerified(event: DomainVerifiedEvent): WorkOrder[] {
    const changed: WorkOrder[] = [];
    for (const [id, order] of this.orders) {
      const next = applyDomainVerified(order, event);
      this.orders.set(id, next);
      if (next !== order) changed.push(next);
    }
    return changed;
  }
}

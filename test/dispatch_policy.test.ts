import assert from "node:assert/strict";
import test from "node:test";
import { applyDomainVerified, type WorkOrder } from "../src/work_orders.js";

test("dispatch becomes ready only when the verified domain belongs to the work order", () => {
  const order: WorkOrder = {
    id: "WO-1042",
    customer_domain: "repairs.shop.example",
    photo_urls: ["https://images.example/WO-1042/before.jpg"],
    technician_follow_up: "Confirm the replacement seal after the first cycle.",
    dispatch_status: "waiting_for_domain",
  };

  const unrelated = applyDomainVerified(order, {
    type: "dns.domain.verified",
    data: { domain: "another.shop.example", zone_id: "zone_other" },
  });
  assert.equal(unrelated.dispatch_status, "waiting_for_domain");

  const matched = applyDomainVerified(order, {
    type: "dns.domain.verified",
    data: { domain: order.customer_domain, zone_id: "zone_storefront" },
  });
  assert.equal(matched.dispatch_status, "ready_to_dispatch");
});

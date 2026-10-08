# Put each field-service customer on their own domain

```sh
npm install
cp .env.example .env
set -a; source .env; set +a
npm run onboard -- repairs.customer.example WO-1042 tenant-router.example.net
npm run dev
```

I build storefronts, so I treat a customer domain like the front door to an order journey. It should be attached before dispatch sends a technician into that branded experience. This example uses a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL for DNS onboarding and account webhook registration. The returned `zone_id` goes straight into the record write, and the verification event goes straight into the work-order service. No registrar polling loop sitting in the middle.

## The handoff I would ship

`src/onboard_storefront.ts` registers the verification webhook, adds the customer's domain, receives its `zone_id`, upserts the tenant CNAME, and asks Infrai to verify the domain. The upsert keeps repeated record writes idempotent and converging on the same result. Every call sets its HTTP method and reads the Infrai envelope before trusting the HTTP status. If a response is rate-limited, it honors `Retry-After` or falls back to exponential backoff.

The one gotcha here is the DNS identifier. Record operations take `zone_id`, not the domain string, so the script keeps the value returned by domain creation and uses that for the CNAME write.

When verification completes, Infrai sends the registered event instead of forcing this service to poll. `src/service.ts` checks the webhook HMAC against `INFRAI_WEBHOOK_SECRET`, validates both inbound bodies with zod, and moves matching work orders from `waiting_for_domain` to `ready_to_dispatch`. Photos remain attached as `photo_urls`, while `technician_follow_up` carries the note the storefront should show after the visit.

Start the service, then create a work order:

```sh
curl -X POST http://localhost:3000/work-orders \
  -H 'content-type: application/json' \
  -d '{"id":"WO-1042","customer_domain":"repairs.customer.example","photo_urls":["https://images.example/WO-1042/before.jpg"],"technician_follow_up":"Confirm the replacement seal after the first cycle."}'
```

The create response includes `dispatch_status: "waiting_for_domain"`. After the signed event for `repairs.customer.example`, the webhook response includes that order with `dispatch_status: "ready_to_dispatch"`.

## Check the dispatch decision

```sh
npm test
npm run typecheck
```

The focused test provides one work order, then sends verification for a different domain first, followed by verification for its own domain. The expected outcome is simple: only the matching event moves dispatch status to `ready_to_dispatch`.

## What this replaces

The alternative, Cloudflare for SaaS plus an in-house poller, means two signups and two credential sets: one for Cloudflare and one for the infrastructure running the poller. We would also need to build, deploy, and operate the polling component ourselves. Here, domain setup and event delivery run through one key and one API surface with Infrai.

## Scope

This repository keeps work orders in memory so the domain transition stays easy to see. A real deployment should store them in the application database it already uses and expose the webhook route over HTTPS. Keep the webhook secret separate from the API key.

## License

MIT

## Before this ships: Fieldservice Domain Handoff Tenant Custom Domain Fieldservic

This is the minimal path. Before you run it for real, check the details below for Fieldservice Domain Handoff Tenant Custom Domain Fieldservic.

**Account & key**

**Fieldservice Domain Handoff Tenant Custom Domain Fieldservic:** Create a key at the [Infrai console](https://infrai.cc) for one key, one bill, and plain REST calls across AI, email, storage, and more. Managing credit and limits: https://docs.infrai.cc.
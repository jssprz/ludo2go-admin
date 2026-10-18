# Guide Editing

Guide blocks use the existing `GuideBlock.data` JSON field and existing block UUIDs.
No revision, checklist, or anchor records are created.

## Contracts

`lib/guide-blocks.ts` defines all fourteen block schemas and the metadata used by
structured forms. The optional advanced editor preserves additional JSON keys.
Client validation and authenticated block APIs share these schemas. Invalid
requests return HTTP 400 with field-path issues.

Block create/update and referenced catalog variant associations are saved in one
database transaction. All variants of a referenced product are linked through
`GuideProductVariant`; existing unused associations are retained and shown as
warnings. Reordering uses the existing `sortOrder` field and does not change IDs.

New guides and copies record the authenticated admin as author and editor, using
the admin's current display name. Metadata edits preserve the original author.
Block and product-association mutations update the last editor in the same
transaction. Client-supplied author/editor attribution is ignored. Existing guides
with no author remain unattributed; no historical authorship is inferred.

## Scheduling

Choose `scheduled` and a future publishing date/time to store `scheduledAt`.
Inputs use the browser's local timezone and submit UTC ISO timestamps. Switching
to another status clears the schedule; copies always start as unscheduled drafts.
Scheduling is available in the detail editor, list create/edit dialogs, and inline
in the list's Status column.

Vercel calls `GET /api/cron/publish-guides` daily at 00:00 UTC (`0 0 * * *`).
The job atomically publishes guides whose status is `scheduled` and whose
`scheduledAt` is at or before the job's current time. It sets `publishedAt` to
the publication time and clears `scheduledAt`. Future schedules, missing dates,
and guides in other statuses are not changed. Repeated calls do not republish
guides that have already transitioned to `published`.

Set `CRON_SECRET` in the Vercel project's production environment before deploying.
Vercel sends it as `Authorization: Bearer <CRON_SECRET>`; the endpoint rejects
requests without the matching secret. Cron jobs run on production deployments.
Because the job runs daily, a guide may publish up to roughly 24 hours after its
scheduled time. The storefront must keep non-published guides private, including
listings, direct URLs, and sitemaps.

## Rendering Boundary

The production storefront renderer is not part of this repository. The admin
editor does not include a separate preview renderer. Any future preview should
reuse the production component. Storefront integration should adopt these rules:

- Render blocks instead of legacy `intro` and `content` whenever blocks exist.
- Sanitize Tiptap HTML at render time using `lib/guide-html.ts` without changing
  stored HTML.
- Generate anchors with `blockAnchor(id)`, never with type or position.
- Resolve products from the stored slug fields.

The publication checklist runs on demand, validates catalog slugs, and stores no
results. Image checks validate URLs and descriptions, not remote asset reachability.

## Verification

```sh
npx tsx --test tests/guideBlocks.test.ts tests/guideChecklist.test.ts tests/guideScheduling.test.ts
npx vitest run --config tests/vitest.guides.config.ts --reporter=verbose
npx tsc --noEmit
```

Interaction tests use real block and variant editors with mocked network,
navigation, and database snapshots. They do not establish live database or
storefront behavior. Navigation protection covers editor dismissal, internal
links, and browser unload; same-document SPA history navigation and tab switches
are not intercepted.
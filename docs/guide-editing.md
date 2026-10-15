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
Scheduling is available in both the detail editor and list create/edit dialogs.
This admin stores scheduling intent, not a background publishing job. The
storefront or publishing worker must honor due scheduled guides while keeping
future scheduled guides private, including listings, direct URLs and sitemaps.

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
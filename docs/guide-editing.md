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
npx tsx --test tests/guideBlocks.test.ts tests/guideChecklist.test.ts
npx vitest run --config tests/vitest.guides.config.ts --reporter=verbose
npx tsc --noEmit
```

Interaction tests use real block and variant editors with mocked network,
navigation, and database snapshots. They do not establish live database or
storefront behavior. Navigation protection covers editor dismissal, internal
links, and browser unload; same-document SPA history navigation and tab switches
are not intercepted.
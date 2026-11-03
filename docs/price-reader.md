# Price Reader

Price Reader watches image attachments in the configured Discord channel and
matches the detected Discord price against the shop owner's price table. Versions
1.0.0 and 2.0.0 continue using Tesseract OCR. Version 3.0.0 uses the owner's Google
Gemini API key. No automatic upgrade or fallback changes the selected reader.

## Gemini setup

1. Deploy migration `20261102000001_price_reader_gemini.sql`, then the Backend and
   Runner together, then Frontend. The new version starts **DRAFT**. Publish 3.0.0
   through Admin Packages only after the matching services are deployed.
2. Upgrade the Price Reader license using the existing package upgrade flow.
   Matching configuration keys and message designs carry over. Upgrading from
   1.0.0 changes price selection to the standard price, as in 2.0.0.
3. Create a key in [Google AI Studio](https://aistudio.google.com/apikey). In
   **Gemini AI**, enter `GEMINI_API_KEY` and the image-capable model name in
   `PRICE_READER_GEMINI_MODEL`. The default is `gemini-3.5-flash-lite`; availability,
   free eligibility and limits depend on the customer's project and Google.
4. **Test connection** sends a small synthetic text extraction using the current
   draft key/model. A blank key uses the encrypted saved key. Testing consumes
   customer quota and does not save configuration. It verifies generation and
   structured output; use the image test to verify actual screenshot reading.
5. **Test** accepts PNG, JPEG or WebP up to 10 MiB and sends the selected image to
   Gemini through the Backend. Price matching and presentation previews use the
   same result functions as the Runner. Save all after reviewing the result.
6. Send a screenshot in the configured reader channel to check the Discord flow.
   Enable Message Content Intent and give the bot View Channel, Send Messages,
   Read Message History and Embed Links as appropriate.

Keys use the existing encrypted feature-secret storage and are not returned to
browsers. They never belong in ordinary config values, URLs, logs, VITE variables
or persistent browser storage. The Runner calls only Google's fixed HTTPS API
endpoint with the key in `x-goog-api-key`; owners configure a model, not an API URL.
Customer keys may use Free or Paid tiers; the application never changes Google
billing or switches to a different key/model automatically.

If activation previously failed before a key or channel was configured, saving a
corrected Gemini key, model, reader channel or order channel requeues that
license's failed Price Reader installation. The retry follows the normal runtime
poll and changes `ERROR` to `INSTALLING`, then to `ACTIVE` only after startup
succeeds. Disabled or removed installations and other error codes are untouched.
A request saving only presentations does not trigger an activation retry.

API key validation accepts both legacy keys and Google AI Studio auth keys with
the `AQ.` prefix. Existing deployments must apply the append-only corrective
migration `20261102000002_price_reader_auth_keys.sql` and release Backend, Runner
and Frontend before testing these keys. The migration updates only the catalog
validation pattern; saved credentials and customer configuration are preserved.

## Reading and failure behaviour

Gemini returns a constrained JSON object containing the visible item name,
currency, standard/current purchase price, crossed-out original price, Nitro
price, discount and ambiguity flag. Prices are integer satang and validated before
matching. Only an explicit THB price with an unambiguous standard purchase amount
is eligible. Missing standard prices never fall back to Nitro or original prices.
No exchange rate, inferred price or AI-generated shop selling price is used.
The ordinary tolerance, price table, result blocks, templates, Embed and Components
V2 settings still determine the shop response. AI output can be incorrect even
when valid JSON; evaluate representative screenshots before publishing the version.

The Runner preserves image colour and layout, strips metadata by re-encoding,
limits decoded images to 40 million pixels, and resizes to at most 2048 by 2048
before sending JPEG to Gemini. The browser rehearsal sends the original image,
so extraction can differ. Discord attachment downloads are restricted to approved
Discord CDN URLs, with download timeout and 10 MiB size limit.

Processing is serial per installation, with at most 20 queued/in-flight messages.
Requests time out and are not automatically retried. A 429 pauses further Gemini
calls in that installation using bounded Retry-After (default 60 seconds). Queued
images during the pause receive a quota explanation. Limits are per Google
project, so other bots or applications sharing that project also consume quota.
Key/permission, unavailable model, quota, network/service and invalid response
failures have safe messages. Recoverable API failures keep the feature ACTIVE;
shutdown cancels the active Gemini request and discards pending reads.
Mentions from Gemini-generated item names do not notify Discord members.

## Dashboard API

Authenticated owner: `POST /api/v1/feature-licenses/{licenseId}/price-reader/test`.
Admin: `POST /api/v1/admin/bots/{botId}/licenses/{licenseId}/price-reader/test`.
Admin requests also require that the license is installed on that bot.
Both require an active, unexpired Gemini-capable license. The existing API write
rate limiter applies. Requests contain `model`, optional draft `apiKey`, and optional
`imageBase64` plus `mimeType`. Neither test route persists settings. Provider results
are `{ connected, errorCode, result }`; connection probes omit extraction results.
Authorization/validation failures use the normal ProblemDetail response.

The preview gateway and Runner use the same JSON schema; their contracts are
validated together. No internal runtime/bootstrap DTO change is needed: model
config and encrypted feature secrets already use the shared bootstrap contract.
Publish Backend and Runner together so the dashboard test and installed version
are available together.

## Google service conditions

The UI discloses that images leave the application and that Free Tier content may
be used to improve Google's products. Use product screenshots without personal,
confidential or sensitive information. Before offering this integration, check
[Gemini terms](https://ai.google.dev/gemini-api/terms), including the restrictions
on API clients directed towards or likely accessed by under-18s and regional
availability. A customer's API key does not waive these restrictions.

See [image input](https://ai.google.dev/gemini-api/docs/image-understanding),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[pricing](https://ai.google.dev/gemini-api/docs/pricing), and
[project rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Version 3.1.0: Nitro modes and product types

The owner selects **Without Nitro** (`STANDARD`), **With Nitro** (`NITRO`) or **Both** (`BOTH`) in
**Pricing → Shop pricing mode**. Gemini reads the current standard price and the
explicit Nitro price independently, in the same API request as classification.
The selected mode determines both the Discord amount used for lookup and the
shop-price table. A missing Nitro price never falls back to standard or original
prices; a missing standard price never falls back to Nitro.

Versions 3.1 and 3.2 recognize a Discord Nitro logo/badge beside a price even when
the word Nitro is absent. In the mobile comparison layout, crossed-out THB 380.00
followed by the Nitro badge and THB 295.00 identifies 380 as the non-Nitro price and
295 as the Nitro price. The crossed-out reference remains `originalPriceSatang`
and also supplies `standardPriceSatang` only with this explicit comparison evidence.
An ordinary sale without a Nitro marker instead uses the current sale amount as
standard and leaves Nitro absent. Additional promotions or unclear comparison
evidence leave the non-Nitro amount unknown; the matcher never promotes an
unclassified original amount into a missing tier. Header Shop-credit balances,
gift icons and variant counts are not purchase-price evidence. With the provided
single-item example table, the 380/295 comparison quotes 115/75 baht respectively.
Deploy Backend and Runner together for this extraction correction; no configuration,
catalog upgrade, database migration or Frontend release is required. Prompt contract
and mocked gateway tests verify request parity and matching, not live model accuracy;
retest representative screenshots using the customer's configured model after release.

**Both** displays two labelled quotes for the same detected product type from
one Gemini request. Each tier uses its own visible Discord price and shop table.
If only one price is visible, the available tier is quoted and the other says
“ไม่พบราคาในรูป”. A visible price without a matching rule uses the configured
unmatched-price message for that tier. If neither price is visible, the image
receives the normal not-found result. One image remains one result in the counts.

There are four independently editable tables: single/standard, bundle/standard,
single/Nitro and bundle/Nitro. Rows use `itemType`, `pricingMode`,
`discordPriceSatang` and `shopPriceSatang`. Equal Discord prices may have different
shop prices in different categories. Duplicate amounts inside one category are
rejected; satang must be whole numbers. Up to 400 rows are supported in total.
The existing tolerance applies only inside the selected category. An absent
category never borrows another category's price.

Gemini must identify one purchasable listing. A labelled bundle or several
included components under one purchase price is `BUNDLE`, even though it contains
multiple products. A clearly individual item is `SINGLE`. Insufficient evidence
is `UNKNOWN` and receives an explanation instead of a quote. Multiple independent
listings or conflicting prices remain ambiguous. Neither type nor membership is
inferred from a price or a product name alone.

The old `PRICE_READER_PRICE_MAP` remains preserved during upgrade. New category
tables start empty because old rows do not identify a type or membership mode.
Select the intended category and use **Import old prices into this table** for
an empty category, then review its prices before saving. Import never overwrites
a non-empty table or populates another category automatically.

Results expose `item_type`, `item_type_key`, `pricing_mode`, `pricing_mode_key`,
`standard_price` and `nitro_price`, plus `standard_shop_price`, `nitro_shop_price`
and their `_text` variants. In Both mode `discord_price` and `shop_price_text`
contain both labelled values, so the default template and existing blocks show
both tiers. `shop_price`, `matched_discord_price` and `match_distance` are blank
in Both mode because they describe a single quote; use the tier-specific fields
in custom designs. `shop_price_found` is true only if both tiers match.
The new default template names the product type and mode;
upgraded custom templates and message designs are preserved. Browser rehearsal
and Discord share classification validation and category matching.

Apply `20261102000003_price_reader_pricing_modes.sql` and
`20261102000004_price_reader_both_modes.sql` after all earlier pending
migrations, release Backend and Runner together, then Frontend, and publish the
new draft **3.1.0** version. The preview API selects its schema from the licensed
configuration definitions; clients cannot opt a 3.0 license into the new contract.
Versions 1.0, 2.0 and 3.0 retain their original price-selection behaviour.

## Version 3.2: counted bundles and Thai/English replies

Version 3.2.0 adds ten independent price tables: single items and bundles containing
2, 3, 4 or 5 products, each with STANDARD (without Nitro) and NITRO prices. The rule
key is `(itemType, itemCount, pricingMode, discordPriceSatang)`; amounts remain
integer satang. Counts and modes never substitute for one another, and matching
is exact. Generic legacy bundle rows cannot identify a count and are never copied
into every bundle table automatically. The old tables remain available for explicit
reviewed import into one selected table. No license upgrades automatically.

Gemini reads Thai and English evidence of the number of products included in one
purchase, such as “includes 3 items” or “บันเดิลประกอบไปด้วยไอเทม 3 รายการ”. Preview
thumbnails, screenshots, backgrounds and variants are not item counts. An explicit
unsupported bundle count (above 5) is rejected. Ambiguous listings or unreadable
prices require a better screenshot instead of a count guess.

When a valid listing has readable THB prices but its included count is unknown,
the bot asks the original sender to select a count. A known bundle offers 2–5;
an unknown product type also offers single item. Each image is confirmed in order.
Selections are bound to the sender, channel, guild, message, installation, nonce
and image index. Sessions expire five minutes after the first prompt and are
cancelled on feature stop/restart. There are at most 30 pending sessions per
installation. Confirmation reuses extracted prices without another Gemini call or
retaining image bytes. Unresolved images never receive a shop quote.

`PRICE_READER_LANGUAGE` selects TH or EN for standard bot replies and count
selection. The dashboard follows its own selected language. New standard templates
use language variables (`image_label`, `discord_price_label`, `shop_price_label`,
`currency_label`, `results_heading`, `processing_text`, `images_label`, `order_label`)
and `item_count`. Owner-written messages/designs are preserved on upgrade and are
not automatically translated. The Status messages screen offers an explicit confirmed
**Reset standard messages** action in the draft; Save all applies it.

The JSON file importer validates and previews rule/table counts before explicitly
replacing the draft's counted tables. Saving remains a separate action. The
[provided shop price file](examples/price-reader-count-prices.json) contains all
50 supplied pairs across ten tables, with O normalized to 0. It preserves the
supplied 1,140 → 285 standard three-item bundle entry exactly; no formula or
monotonic-price correction is applied. This file is an owner-reviewed import,
not a global default and not an automatic production configuration change.

Apply `20261103000002_price_reader_bundle_counts.sql` via the normal ordered
PostgreSQL gate, deploy Backend and Runner together, then Frontend. The release
starts DRAFT; publish it and upgrade through Admin Packages after deploying the
matching runtime. New counted tables start empty, the response language defaults
to Thai and the pricing mode defaults to Both. Existing keys and matching config
keys can carry over, but the owner must review/import counted prices and choose
whether to keep custom messages or reset to bilingual standard designs.

Tests cover all supplied pairs, conflicting prices across counts, missing prices,
non-substitution, malformed extraction, count confirmation ownership/expiry/stale
clicks, bilingual previews, import/save isolation and responsive Light/Dark screens.


## Editable price wording in 3.2

In **Status messages**, choose **Write custom text** for **Discord prices · Both mode**
and **Shop prices · Both mode**. The editors control the labels, Nitro/standard order,
separator, emoji and line breaks used by `{{discord_price}}` and `{{shop_price_text}}`
in Both mode. They do not change extraction, numeric quotes, table selection or match
flags. Single-tier modes retain their existing amount output.

`PRICE_READER_BOTH_DISCORD_TEMPLATE` and `PRICE_READER_BOTH_SHOP_TEMPLATE` accept up to
1,000 characters each. `PRICE_READER_MISSING_PRICE_TEXT` controls the message for an
absent image price, independently from the existing unmatched-shop-price message.
All three default to `{{default}}`, preserving the previous output and following
TH/EN. **Use automatic text** resets one field; **Reset standard messages** in the
same screen confirms a reset of all text and designs in the draft. **Save all** is
still required. Custom wording stays unchanged when the response language changes.

Use `standard_price_text` / `nitro_price_text` for an amount or the configured missing
message. The raw `standard_price` / `nitro_price` variables remain blank when absent.
`standard_shop_price_text` / `nitro_shop_price_text` include the normal currency unit
when matched, while `standard_shop_amount_text` / `nitro_shop_amount_text` omit it
for custom currency notation. Both shop text variants retain missing and unmatched
messages; a zero shop price remains `0.00`. `standard_label`, `nitro_label` and
`currency_label` follow the bot language. These variables also work in per-image
blocks/templates and Message design.

For example, write the following Discord price format:

```text
💎 Nitro: {{nitro_price_text}}
👤 Standard: {{standard_price_text}}
```

The outer per-image template controls the code styling and units surrounding
`{{discord_price}}`. Remove its backticks to render Markdown, and remove an outer
currency suffix when the custom format already supplies units. Both **Status
messages** and **Result text** have a live draft preview. The Test panel reuses the
last image extraction when formatting changes and does not call Gemini again.

Apply `20261103000003_price_reader_price_text.sql` through ordered database delivery,
then release Backend and Runner together before Frontend. This compatible addition
extends 3.2.0 without a catalog publication/version upgrade or changes to saved
customer values, prices, secrets or designs. Earlier Price Reader versions keep
their existing controls and output. Ownership and mapped coverage remain under the
existing Price Reader source folders, test patterns and migration filename rules.


## AUTO source and owner-set Gift offers in 3.2

**Quote options** separates the Discord price source from the shop offer type.
Choose **Auto · Nitro when visible** to use an explicitly extracted Nitro price
when present, otherwise the standard price. With both visible, AUTO picks Nitro;
it does not infer account membership or choose by amount size. A missing shop or
Gift rule never switches AUTO to the other tier. The standard, Nitro and Both-tier
source modes remain available. Existing source settings/defaults stay unchanged;
select AUTO explicitly when ready.

**Prices to show** selects SHOP, GIFT or BOTH. SHOP is the compatible default.
Each of the same ten count/tier tables can contain an optional `giftPriceSatang`
for every existing Discord/shop row. In Quote options, select a Gift table and
enter Gift amounts in baht. Blank removes the Gift value, null also means unset,
and zero is valid. At most two decimal places and 1,000,000 THB are allowed. Add
new Discord rows in Pricing; editing their shop amounts preserves their Gift
values. JSON imports validate the optional integer-satang field and their confirmed
replacement includes Gift values. The original 50-price file has no Gift amounts;
importing it replaces those amounts with unset values as disclosed by the dialog.

An example row (not an automatically installed customer price) is:

```json
{"itemType":"SINGLE","itemCount":1,"pricingMode":"NITRO","discordPriceSatang":29500,"shopPriceSatang":7500,"giftPriceSatang":10000}
```

That row quotes Discord 295, shop 75 and Gift 100. A standard 380 screenshot uses
its own standard row, including its own optional Gift amount. Unset Gift values
show `PRICE_READER_GIFT_UNAVAILABLE_TEXT` (automatically “สอบถามราคา Gift” or “Ask
for Gift price”). They never reuse a shop amount or another count/tier's Gift.
Gemini does not set Gift amounts. Source/offer selection and preview changes reuse
the same extraction without extra Gemini requests.

`gift_price` / `gift_price_text` expose the chosen Gift amount/display; raw Gift
is blank for Both-tier source. Per-tier `standard_gift_price`, `nitro_gift_price`,
`standard_gift_price_text`, `nitro_gift_price_text` and their `_amount_text` forms
support custom layouts. `gift_price_found` and `offer_price_found` report availability.
`shop_offer_text` always retains the ordinary shop display, while `shop_price_text`
and `offer_price_text` follow the selected SHOP/GIFT/BOTH offer choice so existing
result templates continue working. Raw shop numeric fields stay unchanged. The
`shop_price_label` variable follows the offer choice; owner-written fixed headings
remain under owner control. `PRICE_READER_BOTH_GIFT_TEMPLATE` formats Gift for
Both-tier source, and `PRICE_READER_OFFER_TEMPLATE` combines shop and Gift. Edit
these and the unset-Gift message in Status messages. Automatic defaults follow
TH/EN; custom text remains unchanged. Save all applies the reviewed draft.

One failed image, including a Gemini service or connection error, does not discard
other images' successful quotes. No automatic retry was added. The generic temporary
error does not identify its HTTP code: distinguish quota/rate-limit 429 from service
unavailable 503 using diagnostics, not the screenshot alone. See
[Google API errors](https://ai.google.dev/gemini-api/docs/api-errors).

Apply ordered migration `20261103000004_price_reader_auto_gift.sql` after the price
text migration, release Backend and Runner together, then Frontend. No feature
version upgrade/publication is needed. Customer prices, saved modes, designs and
secrets are preserved; no Gift prices are invented or copied automatically.

Frontend validation/table editing and the default processing preview use the thin
counted core. Quote calculation loads on Test, Result text, Status messages or a
result/error message preview. A direct message-editor visit loads it before editing.
Wallet and Robux label/description data load only for their own screens. Explicit bundle profiles
cover these version/feature-specific imports, including the counted message editor,
without changing existing limits. Browser coverage verifies deferred requests,
AUTO and offer switching, edit/save/reload, prior versions and Robux controls.

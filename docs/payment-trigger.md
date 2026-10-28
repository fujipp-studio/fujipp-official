# Payment Trigger

An administrator sends `p100` (or the configured prefix and amount) to post payment
options. Bank QR and manual Wallet transfers retain their existing behavior.

## TrueMoney envelopes

In **Payment Trigger → Wallet**, enable **รับชำระด้วยซองอั่งเปา** and set the
receiving Wallet number. This option defaults to off for existing installations.
It uses Payment Trigger's `WALLET_NUMBER`; a Wallet Top-up installation is not
required.

The customer selects **ชำระด้วยซองอั่งเปา**, enters their TrueMoney campaign link
in a Discord modal, and submits. The envelope must have one recipient and its
amount must exactly match the original payment amount. For `p100`, use a 100-baht
envelope. The manual Wallet surcharge does not apply. Money is received directly;
this does not credit the customer's internal Wallet balance.

Only an explicit successful redemption for the correct amount produces the
public **ชำระเงินสำเร็จ** message. Configure that new message slot as either Embed
or Components V2, independently of the selector's format. Available values include
`{{paid_amount}}`, `{{member_mention}}`, `{{member_id}}`, `{{payment_id}}`,
`{{reference}}`, `{{payment_method}}`, and `{{datetime}}`. The payer also receives a
private confirmation, and the original selector's buttons are disabled. A failure
to publish a receipt does not mark a received payment as failed or retry receipt
publication automatically.

Envelope errors are shown privately. Invalid or wrong-value envelopes can be
corrected and submitted again. A payment whose result is pending or ambiguous
must be checked by an administrator before another payment is attempted; the
backend holds its invoice claim to prevent a second charge. The private redemption
ledger records the payment message ID and expected amount; raw gift links are not
stored. A voucher cannot pay another invoice or subsequently credit Wallet Top-up.

## Place feature buttons in Components V2

Open the payment-method message in the Components V2 editor. Existing payment
buttons appear as an editable row without changing the saved design until an edit
is made. Use **ย้ายไป** or drag the row into a Container, out to the message root,
or between Containers. The arrow controls reorder rows and individual buttons.

Choose **+ ปุ่ม Feature** at the message root, inside a Container, or in an
existing button row, then select Bank QR, Wallet, or TrueMoney envelope. A button's
**การทำงานของปุ่ม** selector changes its function; text, emoji and color remain
editable. Link buttons can share a row with feature buttons. Each row supports up
to five buttons and the message retains the 40-component limit.

The envelope option remains available in the editor when envelope payments are
off. An explicitly placed envelope button is shown disabled in the preview and
in Discord until receiving envelopes is enabled in **Payment Trigger → Wallet**.
Send a new trigger after enabling it; already posted messages retain their old
button state.

Custom layouts keep the selected order and placement without an extra automatic
button row. Removing all payment buttons intentionally keeps them removed. Older
designs that have not been edited keep their original automatic buttons. This
layout update requires matching Runner and Frontend code, with Runner deployed
before authors save layouts containing feature buttons; it needs no additional
database migration.

## Deployment

Apply `20261028000001_payment_trigger_vouchers.sql` through the repository's
migration deployment, then deploy Backend, Runner, and Frontend. Deploy the migration
before the updated Backend, since the shared voucher ledger gains two nullable
columns. Existing wallet-only redemptions keep null payment fields, and existing
saved message designs remain intact. Enable the option after all components are
updated. Existing payment selectors need to be sent again to show the new button.

The Runner calls the existing internal voucher endpoint with `paymentMessageId`
and `expectedAmountSatang`. The Backend resolves the recipient from an active,
licensed Payment Trigger installation with envelopes enabled. A database uniqueness
constraint claims the invoice before contacting TrueMoney, preventing concurrent
submissions from receiving two vouchers for one invoice. Successful, processing,
and reconciliation-required claims remain reserved; a conclusive verification
failure releases the invoice for a corrected envelope.

## VPS migration (2026-10-28)

Migration `20261028000001_payment_trigger_vouchers.sql` was applied to the active
VPS PostgreSQL database `migration_cutover_20261022` after a full custom-format
backup and a successful rehearsal against a disposable restored database. The
SQL and its migration-history entry were committed in one transaction. The
rehearsal database was removed after validation.

Verification confirmed that all 236 existing voucher records, customer Wallet
balances and entries, configuration values and saved presentation overrides were
unchanged. Voucher RLS and backend grants remain intact, the envelope default is
`false`, and the Backend remained healthy. No real voucher was redeemed during
validation.

The backup, exact SQL, rehearsal logs and production verification are retained
in the private VPS directory
`/opt/fujipp/apps/fujipp-postgres/migrations/payment-trigger-vouchers-20261028/`.
The migration is recorded as `20261028000001:payment_trigger_vouchers`; migration
deployment must honor that history instead of running the SQL a second time.
Application containers still require deployment of the matching feature code
before envelope payments can be enabled.

## Version 1.1.0: Back and response choices

Upgrade the package to **1.1.0**, then open the **Bank QR payment** or **Wallet
payment** message. A **กลับไปเลือกช่องทาง** button returns to the payment-method
selector using the same amount and invoice. The Components V2 editor projects a
Back row inside the last Container for older designs. Use **+ ปุ่ม Feature** to
add another Back button at the root, inside any Container, or in a button row;
move, rename, recolor, or delete it as usual. Embed messages expose its settings
under feature components.

Each feature button has **เมื่อกดปุ่มนี้** with **อัปเดตข้อความเดิม** or
**ส่งข้อความใหม่**. Bank, Wallet, and Back default to updating the original
message. The envelope button defaults to sending a new receipt; its response
choice applies after a confirmed payment, while clicking it still opens the
link modal. Updating a receipt replaces the payment controls with the success
design. Sending a receipt separately disables the controls on its source message.
Copies created by navigation share one invoice and the backend's duplicate-payment
protection.

Discord permits changing an Embed to Components V2, but cannot change a
Components V2 message back to Embed. For that transition, select **ส่งข้อความใหม่**
or use Components V2 for both messages. Incompatible updates show a private error;
an incompatible envelope receipt is rejected before redeeming money.

Deploy the updated Runner and Frontend with
`20261029000001_payment_trigger_v1_1.sql`. The migration publishes 1.1.0, marks 1.0.0 as `DEPRECATED` to satisfy the
one-published-version constraint, and clones its configuration and message slots. Existing licenses stay on their current
version until upgraded through the normal package upgrade action, which preserves
saved configuration and message designs. Post a fresh trigger to use the new
per-button responses. Old 1.0 buttons and open envelope modals remain supported.


## VPS migration 1.1.0 (2026-10-29)

Migration `20261029000001_payment_trigger_v1_1.sql` was applied to VPS database
`migration_cutover_20261022` after a verified full backup and successful rehearsal
against a restored copy of the production database. The migration and history
entry `20261029000001:payment_trigger_v1_1` committed in one transaction.

Verification confirmed five configuration keys and five message slots for 1.1.0,
including Back-button and response-mode defaults. Existing configuration, saved
designs, licenses, installations and financial records were preserved, including
238 voucher records; private ledger access remained restricted and the Backend
stayed healthy. Existing installations remained on their acquired versions. The
rehearsal database was removed.

The backup, exact SQL and verification logs are retained in the private directory
`/opt/fujipp/apps/fujipp-postgres/migrations/payment-trigger-v1-1-20261029-verified/`.
Migration deployment must honor the recorded history and skip reapplying this SQL.
The VPS Runner did not yet contain the 1.1.0 module at migration time: deploy the
matching Runner and Frontend before upgrading a package to 1.1.0.

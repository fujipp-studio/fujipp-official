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

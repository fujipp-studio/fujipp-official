import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const mailpitURL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324'
const backendURL = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8081'
const password = 'LocalE2e123!'

interface MailpitMessageSummary {
  ID: string
  To: Array<{ Address: string }>
}

interface MailpitMessages {
  messages: MailpitMessageSummary[]
}

interface MailpitMessage {
  HTML?: string
  Text?: string
}

test.describe('email authentication', () => {
  test('signs up, confirms email, restores the session, and signs out', async ({
    page,
    request,
  }) => {
    const email = `e2e-${Date.now()}-${test.info().parallelIndex}@example.com`

    await expectLocalServices(request)
    await page.goto('/design-system')

    await page.getByRole('button', { name: 'Sign up', exact: true }).first().click()
    const signupDialog = page.getByRole('dialog', { name: 'Create an account' })

    await signupDialog.getByRole('textbox', { name: 'Email*' }).fill(email)
    await signupDialog.getByLabel('Password*', { exact: true }).fill(password)
    await signupDialog.getByLabel('Confirm Password*').fill(password)
    await signupDialog
      .getByRole('checkbox', { name: /Do you agree to our Terms/ })
      .check()
    await signupDialog.getByRole('button', { name: 'Create account' }).click()

    await expect(signupDialog).toContainText(
      'Check your email to confirm your account before signing in.',
    )

    const confirmationURL = await waitForConfirmationURL(request, email)
    await page.goto(confirmationURL)
    await page.waitForURL('**/design-system')

    await expectAuthenticatedNavbar(page, email)

    await page.reload()
    await expectAuthenticatedNavbar(page, email)

    const profileButton = page
      .getByRole('button', { name: 'Open profile', exact: true })
      .first()
    await profileButton.click()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()

    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }).first(),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
    const signInDialog = page.getByRole('dialog', { name: 'Sign in' })
    await signInDialog.getByRole('textbox', { name: 'Email*' }).fill(email)
    await signInDialog.getByLabel('Password*', { exact: true }).fill(password)
    await signInDialog.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expectAuthenticatedNavbar(page, email)
  })
})

async function expectLocalServices(request: APIRequestContext) {
  const [mailpit, backend] = await Promise.all([
    request.get(`${mailpitURL}/api/v1/messages`),
    request.get(`${backendURL}/actuator/health`),
  ])

  expect(
    mailpit.ok(),
    `Mailpit is unavailable at ${mailpitURL}. Start Supabase local first.`,
  ).toBe(true)
  expect(
    backend.ok(),
    `Backend is unavailable at ${backendURL}. Start the Backend first.`,
  ).toBe(true)
}

async function expectAuthenticatedNavbar(page: Page, email: string) {
  const profileButton = page
    .getByRole('button', { name: 'Open profile', exact: true })
    .first()

  await expect(profileButton).toBeVisible({ timeout: 20_000 })
  await profileButton.click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await profileButton.click()
}

async function waitForConfirmationURL(request: APIRequestContext, email: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitURL}/api/v1/messages`)
        if (!response.ok()) return null

        const mailbox = (await response.json()) as MailpitMessages
        const message = mailbox.messages.find((candidate) =>
          candidate.To.some((recipient) => recipient.Address === email),
        )
        if (!message) return null

        const detailResponse = await request.get(
          `${mailpitURL}/api/v1/message/${message.ID}`,
        )
        if (!detailResponse.ok()) return null

        const detail = (await detailResponse.json()) as MailpitMessage
        return extractConfirmationURL(`${detail.HTML ?? ''}\n${detail.Text ?? ''}`)
      },
      {
        message: `confirmation email for ${email}`,
        timeout: 20_000,
      },
    )
    .not.toBeNull()

  const response = await request.get(`${mailpitURL}/api/v1/messages`)
  const mailbox = (await response.json()) as MailpitMessages
  const message = mailbox.messages.find((candidate) =>
    candidate.To.some((recipient) => recipient.Address === email),
  )
  if (!message) throw new Error(`Confirmation email for ${email} was not found.`)

  const detailResponse = await request.get(`${mailpitURL}/api/v1/message/${message.ID}`)
  const detail = (await detailResponse.json()) as MailpitMessage
  const confirmationURL = extractConfirmationURL(
    `${detail.HTML ?? ''}\n${detail.Text ?? ''}`,
  )
  if (!confirmationURL) throw new Error('Confirmation URL was not found in the email.')

  return confirmationURL
}

function extractConfirmationURL(content: string) {
  const decoded = content.replaceAll('&amp;', '&')
  return decoded.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0] ?? null
}

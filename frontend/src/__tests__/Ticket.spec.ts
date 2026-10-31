import { describe, expect, it } from 'vitest'
import {
  validateTicketDraft,
  defaultTicketBehavior,
  validTicketEmoji,
  validTicketName,
} from '@/features/bots/config/ticket-config'
import { permissionCommands } from '@/features/bots/config/permission-commands'
import { ticketFixture } from './fixtures/ticket'
import { ticketPresentationPreview } from '@/features/bots/models/ticket-presentation-preview'
import { safeTicketAttachmentUrl } from '@/features/bots/ticket-api'

describe('Ticket configuration', () => {
  it('previews the dropdown and close button without changing saved designs', () => {
    for (const mode of ['EMBED', 'COMPONENTS_V2']) {
      const raw = {
        mode,
        embed: { title: 'Ticket' },
        components_v2: { components: [{ type: 10, content: 'Welcome' }] },
      }
      const before = structuredClone(raw)
      expect(ticketPresentationPreview(raw, 'panel').components).toHaveProperty('topic_select')
      expect(ticketPresentationPreview(raw, 'opened').components).toHaveProperty('close_button')
      expect(raw).toEqual(before)
    }
  })
  const draft = () => {
    const { config } = ticketFixture()
    return {
      TICKET_COMMAND_NAME: 'ticket',
      TICKET_CATEGORIES: JSON.stringify(config.fields[1]!.value),
    }
  }
  it('treats Discord history as an explicit opt-in and previews its button only when enabled', () => {
    expect(validateTicketDraft({ ...draft(), TICKET_DISCORD_HISTORY_ENABLED: false })).toBe(true)
    expect(validateTicketDraft({ ...draft(), TICKET_DISCORD_HISTORY_ENABLED: true })).toBe(true)
    expect(validateTicketDraft({ ...draft(), TICKET_DISCORD_HISTORY_ENABLED: 'true' })).toBe(false)
    expect(ticketPresentationPreview({ mode: 'EMBED' }, 'opened').components).not.toHaveProperty(
      'history_button',
    )
    expect(ticketPresentationPreview({ mode: 'EMBED' }, 'opened', true).components).toMatchObject({
      close_button: { label: 'จัดการตั๋ว' },
    })
  })
  it('only renders HTTPS attachment links from Discord attachment hosts', () => {
    expect(
      safeTicketAttachmentUrl('https://cdn.discordapp.com/attachments/1/2/file.png?ex=123'),
    ).toBeDefined()
    for (const url of [
      'javascript:alert(1)',
      'https://cdn.discordapp.com.evil.invalid/attachments/a',
      'https://cdn.discordapp.com@evil.invalid/attachments/a',
      'https://cdn.discordapp.com/other/path',
    ])
      expect(safeTicketAttachmentUrl(url)).toBeUndefined()
  })
  it('accepts default order and support forms and suggests the panel permission', () => {
    expect(validateTicketDraft(draft())).toBe(true)
    const { ticketLicense, config } = ticketFixture()
    config.fields[0]!.value = 'support'
    expect(permissionCommands(ticketLicense, config).commands.map((item) => item.value)).toEqual([
      'support/panel',
    ])
  })
  it('blocks duplicate keys, invalid IDs, invalid timers and empty enabled forms', () => {
    for (const patch of [
      { categoryId: '' },
      { supportRoleIds: ['invalid'] },
      { supportRoleIds: ['222222222222222222', '222222222222222222'] },
      { autoCloseMinutes: -1 },
      { autoCloseMinutes: 0.5 },
      { autoCloseMinutes: 43201 },
      { autoCloseMode: 'UNKNOWN' },
      { formEnabled: 'true' },
      { formTitle: '' },
      { fields: [] },
      { fields: Array(6).fill({}) },
    ]) {
      const value = draft()
      const rows = JSON.parse(value.TICKET_CATEGORIES)
      rows[0] = { ...rows[0], ...patch }
      expect(validateTicketDraft({ ...value, TICKET_CATEGORIES: JSON.stringify(rows) })).toBe(false)
    }
    for (const value of ['{}', '[]', 'broken', '[null]'])
      expect(validateTicketDraft({ TICKET_CATEGORIES: value })).toBe(false)
  })
  it('allows formless topics with disabled timers', () => {
    const value = draft()
    const rows = JSON.parse(value.TICKET_CATEGORIES)
    rows[0] = { ...rows[0], formEnabled: false, fields: [], autoCloseMinutes: 0 }
    expect(validateTicketDraft({ ...value, TICKET_CATEGORIES: JSON.stringify(rows) })).toBe(true)
  })
  it('accepts optional per-topic pings and rejects malformed or duplicate recipients', () => {
    const value = draft()
    const rows = JSON.parse(value.TICKET_CATEGORIES)
    const valid = {
      enabled: true,
      opener: true,
      roleIds: ['222222222222222222'],
      userIds: ['333333333333333333'],
    }
    for (const mentions of [valid, { ...valid, enabled: false }]) {
      rows[0].openingMentions = mentions
      expect(validateTicketDraft({ ...value, TICKET_CATEGORIES: JSON.stringify(rows) })).toBe(true)
    }
    for (const mentions of [
      null,
      {},
      { ...valid, enabled: 'true' },
      { ...valid, opener: null },
      { ...valid, roleIds: ['bad'] },
      { ...valid, userIds: ['333333333333333333', '333333333333333333'] },
      {
        ...valid,
        roleIds: Array.from({ length: 11 }, (_, i) => String(222222222222222222n + BigInt(i))),
      },
      {
        ...valid,
        userIds: Array.from({ length: 26 }, (_, i) => String(333333333333333333n + BigInt(i))),
      },
    ]) {
      rows[0].openingMentions = mentions
      expect(validateTicketDraft({ ...value, TICKET_CATEGORIES: JSON.stringify(rows) })).toBe(false)
    }
  })
  it('validates limits and explicit closing permissions without changing old drafts', () => {
    expect(validateTicketDraft(draft())).toBe(true)
    expect(
      validateTicketDraft({
        ...draft(),
        TICKET_BEHAVIOR: JSON.stringify({
          ...defaultTicketBehavior,
          maxOpenPerUser: 3,
          confirmClose: false,
          closeRoleIds: ['222222222222222222'],
        }),
      }),
    ).toBe(true)
    for (const patch of [
      { maxOpenPerUser: 0 },
      { maxOpenPerUser: 26 },
      { maxOpenPerUser: 1.5 },
      { confirmClose: 'true' },
      { closeUserIds: ['invalid'] },
      { closeRoleIds: ['222222222222222222', '222222222222222222'] },
    ])
      expect(
        validateTicketDraft({
          ...draft(),
          TICKET_BEHAVIOR: JSON.stringify({ ...defaultTicketBehavior, ...patch }),
        }),
      ).toBe(false)
  })
  it('accepts custom animated or Unicode emoji and documented channel name variables', () => {
    for (const emoji of [
      '',
      '🛒',
      '🇹🇭',
      '<:cart:123456789012345678>',
      '<a:cart:123456789012345678>',
    ])
      expect(validTicketEmoji(emoji)).toBe(true)
    for (const emoji of ['plain text', 'word🙂', '<script>', '<:bad:abc>'])
      expect(validTicketEmoji(emoji)).toBe(false)
    expect(validTicketName('ซื้อ-{{username}}-{{topic}}-{{id}}')).toBe(true)
    for (const value of ['', '{{unknown}}', 'a\nb', '../room'])
      expect(validTicketName(value)).toBe(false)
  })
  it('supports independent commands/buttons and previews only a Close button without changing designs', () => {
    const behavior = {
      ...defaultTicketBehavior,
      controlStyle: 'DIRECT',
      actions: {
        close: 'BUTTON',
        schedule: 'COMMAND',
        autoClose: 'COMMAND',
        addUser: 'COMMAND',
        history: 'OFF',
      },
    }
    expect(validateTicketDraft({ ...draft(), TICKET_BEHAVIOR: JSON.stringify(behavior) })).toBe(
      true,
    )
    for (const mode of ['EMBED', 'COMPONENTS_V2']) {
      const raw = {
        mode,
        embed: { title: 'Welcome' },
        components_v2: { components: [{ type: 10, content: 'Welcome' }] },
      }
      const before = structuredClone(raw)
      expect(
        ticketPresentationPreview(raw, 'opened', true, JSON.stringify(behavior)).components,
      ).toEqual({ close_button: { label: 'ปิดตั๋ว', style: 'danger' } })
      expect(raw).toEqual(before)
      expect(
        ticketPresentationPreview(raw, 'opened', true, {
          ...behavior,
          actions: {
            close: 'COMMAND',
            autoClose: 'COMMAND',
            addUser: 'COMMAND',
            history: 'COMMAND',
          },
        }).components,
      ).toEqual({})
    }
    for (const actions of [
      null,
      [],
      { close: null },
      { close: ['BOTH'] },
      { close: 'UNKNOWN' },
      { unknown: 'OFF' },
    ])
      expect(
        validateTicketDraft({
          ...draft(),
          TICKET_BEHAVIOR: JSON.stringify({ ...behavior, actions }),
        }),
      ).toBe(false)
    expect(
      validateTicketDraft({
        ...draft(),
        TICKET_BEHAVIOR: JSON.stringify({ ...behavior, controlStyle: ['DIRECT'] }),
      }),
    ).toBe(false)
  })
  it('validates optional cancellation messages without requiring existing drafts to change', () => {
    expect(validateTicketDraft(draft())).toBe(true)
    const notice = (value: unknown) => ({
      ...draft(),
      TICKET_BEHAVIOR: JSON.stringify({ ...defaultTicketBehavior, cancellationNotice: value }),
    })
    expect(validateTicketDraft(notice({ enabled: true, message: '**Open**\nThank you' }))).toBe(
      true,
    )
    expect(validateTicketDraft(notice({ enabled: false, message: '' }))).toBe(true)
    for (const invalid of [
      null,
      {},
      { enabled: 'true', message: 'Hello' },
      { enabled: true, message: ' ' },
      { enabled: false, message: null },
      { enabled: true, message: 'a'.repeat(2001) },
    ])
      expect(validateTicketDraft(notice(invalid))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { readBackupDownload, readBackupQuota } from '@/features/bots/member-spending-backup-api'

describe('Member Spending backup responses', () => {
  it('reads quota and the reset time from the backend', async () => {
    const quota = { remaining: 0, limit: 5, resetsAt: '2026-11-22T00:00:00+07:00' }
    expect(await readBackupQuota(Response.json(quota))).toEqual(quota)
  })
  it('reads the ZIP filename and binary without JSON conversion', async () => {
    const filename = 'fujipp_member-spending_123_abc_2026-11-21_23-59-59_ICT.zip'
    const result = await readBackupDownload(
      new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: { 'Content-Disposition': `attachment; filename="${filename}"` },
      }),
    )
    expect(result.filename).toBe(filename)
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]))
  })
  it('surfaces authorization and quota errors without producing a download', async () => {
    for (const status of [403, 404, 409, 429])
      await expect(
        readBackupDownload(Response.json({ detail: 'Export rejected' }, { status })),
      ).rejects.toMatchObject({ status, message: 'Export rejected' })
  })
  it('rejects missing or unsafe filenames', async () => {
    for (const filename of ['', '../../secret.zip', 'backup.html'])
      await expect(
        readBackupDownload(
          new Response('data', {
            headers: { 'Content-Disposition': `attachment; filename="${filename}"` },
          }),
        ),
      ).rejects.toThrow('filename')
  })
})

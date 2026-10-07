export const priceReaderConfigKeys = new Set([
  'PRICE_READER_CHANNEL_ID',
  'PRICE_READER_ORDER_CHANNEL_ID',
  'PRICE_READER_PRICE_MAP',
  'PRICE_READER_NO_NITRO_MARKUP_SATANG',
  'PRICE_READER_RESULTS_ITEM_TEMPLATE',
])

export const priceReaderItemTemplate = (withMarkup: boolean) =>
  '### รูปที่ {{result_index}}\n💙 **ราคาดิสคอร์ด**\n`{{discord_price}} บาท`' +
  (withMarkup ? '{{discount_text}}' : '') +
  '\n💗 **ราคาร้านขาย**\n`{{shop_price_text}}`' +
  (withMarkup ? '\n💛 **ราคาไม่มีไนโตร บวกชิ้นละ**\n`{{no_nitro_markup}} บาท`' : '')

export function priceReaderPricePairs(value: unknown) {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const amount = (satang: unknown, baht: unknown) =>
      typeof satang === 'number' && Number.isFinite(satang)
        ? Math.round(satang)
        : typeof baht === 'number' && Number.isFinite(baht)
          ? Math.round(baht * 100)
          : NaN
    const discord = amount(item.discordPriceSatang, item.discordPrice)
    const shop = amount(item.shopPriceSatang, item.shopPrice)
    return discord > 0 && shop >= 0 ? [{ discord, shop }] : []
  })
}

export function priceReaderSampleValues(
  values: Record<string, unknown>,
  version: string,
  guildId?: string | null,
): Record<string, string> {
  const withMarkup = version.startsWith('1.')
  const pairs = priceReaderPricePairs(values.PRICE_READER_PRICE_MAP)
  const prices = pairs.length ? pairs.slice(0, 2).map((pair) => pair.discord) : [25000, 29500]
  const money = (satang: number) => (satang / 100).toFixed(2)
  const markup = Number(values.PRICE_READER_NO_NITRO_MARKUP_SATANG)
  const common: Record<string, string> = withMarkup
    ? { no_nitro_markup: money(Number.isSafeInteger(markup) && markup >= 0 ? markup : 1000) }
    : {}
  const samples = prices.map((discord, index) => {
    // The runtime chooses the nearest entry within 5 THB; ties keep the first entry.
    const nearest = pairs.reduce<(typeof pairs)[number] | undefined>(
      (best, pair) =>
        !best || Math.abs(pair.discord - discord) < Math.abs(best.discord - discord) ? pair : best,
      undefined,
    )
    const found = nearest && Math.abs(nearest.discord - discord) <= 500
    return {
      ...common,
      status: 'success',
      result_index: String(index + 1),
      discord_price: money(discord),
      shop_price: found ? money(nearest.shop) : '',
      shop_price_found: found ? 'true' : 'false',
      shop_price_text: found ? `${money(nearest.shop)} บาท` : 'ไม่พบราคาที่ตรงกัน',
      item_name: `Discord Shop ${index + 1}`,
      discount_text: '',
      original_price: '',
      nitro_price: '',
      discount_percent: '',
    }
  })
  const template =
    typeof values.PRICE_READER_RESULTS_ITEM_TEMPLATE === 'string'
      ? values.PRICE_READER_RESULTS_ITEM_TEMPLATE
      : priceReaderItemTemplate(withMarkup)
  const orderId = String(values.PRICE_READER_ORDER_CHANNEL_ID ?? '')
  return {
    ...common,
    ...samples[0],
    image_count: String(samples.length),
    success_count: String(samples.length),
    error_count: '0',
    order_url:
      guildId && /^\d{15,30}$/.test(orderId)
        ? `https://discord.com/channels/${guildId}/${orderId}`
        : '',
    results_text: samples
      .map((sample) =>
        template.replace(/\{\{([a-z0-9_]+)}}/gi, (match, key: string) =>
          String(Reflect.get(sample, key) ?? match),
        ),
      )
      .join('\n\n---\n\n'),
  }
}

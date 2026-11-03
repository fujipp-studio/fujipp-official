import { expect, test } from '@playwright/test'
import { priceReaderCountedFixture, providedRules } from '../src/__tests__/fixtures/priceReaderCounted'
for (const theme of ['LIGHT','DARK']) for (const locale of ['th','en']) {
  test(`AUTO and Gift quotes stay isolated and save in ${locale} ${theme}`, async ({page,isMobile},info) => {
    if(isMobile) await page.setViewportSize({width:320,height:900})
    const text=(en:string,th:string)=>locale==='en'?en:th
    await page.addInitScript(theme=>localStorage.setItem('fujipp-theme-mode',theme),theme)
    const {priceLicense,config}=priceReaderCountedFixture(locale==='en'?'EN':'TH')
    await page.route('**/api/v1/feature-licenses',route=>route.fulfill({json:[priceLicense]}))
    await page.route('**/api/v2/feature-licenses*',route=>route.fulfill({json:{items:[priceLicense],hasMore:false,nextCursor:null}}))
    let saved:{values:Record<string,unknown>;secrets:Record<string,unknown>}|undefined
    await page.route('**/configuration',route=>{
      if(route.request().method()==='PUT') {
        saved=route.request().postDataJSON()
        for(const field of config.fields) if(saved?.values[field.key]!==undefined) field.value=saved.values[field.key]
      }
      return route.fulfill({json:config})
    })
    let calls=0,nitro=true
    await page.route('**/price-reader/test',route=>{
      calls++
      return route.fulfill({json:{connected:true,errorCode:null,result:{itemName:'Item',currency:'THB',itemType:'SINGLE',itemCount:1,standardPriceSatang:38000,nitroPriceSatang:nitro?29500:null,originalPriceSatang:38000,discountPercent:null,ambiguous:false}}})
    })
    const quoteModules:string[]=[],robuxModules:string[]=[]
    page.on('request',request=>{
      if(/\/config\/price-reader-counted\.ts(?:\?|$)/.test(request.url())) quoteModules.push(request.url())
      if(/\/config\/roblox-copy\.ts(?:\?|$)/.test(request.url())) robuxModules.push(request.url())
    })
    await page.goto(`/my-bot/fixture-bot/settings/packages/fixture-license?locale=${locale}`)
    const settings=page.locator('[data-price-reader-config]')
    async function category(name:string) {
      if(isMobile) {
        await settings.getByRole('combobox',{name:text('Settings category','หมวดการตั้งค่า'),exact:true}).click()
        await page.getByRole('option',{name,exact:true}).click()
      } else await settings.getByRole('tab',{name,exact:true}).click()
    }
    async function select(label:string,name:string) {
      await settings.getByRole('combobox',{name:label,exact:true}).click()
      await page.getByRole('option',{name,exact:true}).click()
    }
    await category(text('Quote options','รูปแบบเสนอราคา'))
    const offers=settings.locator('[data-price-reader-offers]')
    await select(text('Price source','ราคาที่อ่านจากรูป'),text('Auto · Nitro when visible','อัตโนมัติ · ใช้ Nitro เมื่อเห็นในรูป'))
    await select(text('Prices to show','ราคาที่ร้านแสดง'),text('Shop and Gift','รับกดและ Gift'))
    await offers.locator('[data-gift-discord-price="29500"]').getByRole('spinbutton').fill('100')
    await category(text('Pricing','ตารางราคา'))
    await select(text('Table being edited','ตารางที่กำลังแก้ไข'),text('Single item · with Nitro','ชิ้นเดียว · มี Nitro'))
    const shopInput=settings.locator('[data-price-row]').nth(2).getByRole('spinbutton',{name:text('Shop price (THB)','ราคาร้านขาย (บาท)')})
    await shopInput.fill('76')
    await shopInput.fill('75')
    await category(text('Quote options','รูปแบบเสนอราคา'))
    await expect(offers.locator('[data-gift-discord-price="29500"]').getByRole('spinbutton')).toHaveValue('100.00')
    expect(quoteModules).toHaveLength(0)
    expect(robuxModules).toHaveLength(0)
    await category(text('Test','ทดสอบ'))
    const panel=settings.locator('[data-price-reader-test]')
    await panel.locator('input[type="file"]').setInputFiles({name:'shop.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII=','base64')})
    const read=panel.getByRole('button',{name:text('Read test image','อ่านรูปทดสอบ'),exact:true})
    await read.click()
    const match=panel.locator('[data-price-test-match]')
    await expect(match).toContainText('295.00')
    await expect(match).toContainText('75.00')
    await expect(match).toContainText('100.00')
    expect(calls).toBe(1)
    expect(quoteModules.length).toBeGreaterThan(0)
    await category(text('Quote options','รูปแบบเสนอราคา'))
    await select(text('Prices to show','ราคาที่ร้านแสดง'),text('Gift price','ราคา Gift'))
    await category(text('Test','ทดสอบ'))
    await expect(match).toContainText('100.00')
    await expect(match).not.toContainText('75.00')
    expect(calls).toBe(1)
    nitro=false
    await read.click()
    await expect(match).toContainText('380.00')
    await expect(match).toContainText(text('Ask for Gift price','สอบถามราคา Gift'))
    await expect(match).not.toContainText('100.00')
    await category(text('Quote options','รูปแบบเสนอราคา'))
    await select(text('Prices to show','ราคาที่ร้านแสดง'),text('Shop and Gift','รับกดและ Gift'))
    await offers.screenshot({path:info.outputPath(`auto-gift-options-${locale}-${theme}.png`),animations:'disabled',style:'header.navbar, aside.admin-tools, .app-scroll-rail, .section-indicator {visibility:hidden!important}'})
    await category(text('Test','ทดสอบ'))
    await expect(match).toContainText('115.00')
    await expect(match).toContainText(text('Ask for Gift price','สอบถามราคา Gift'))
    expect(calls).toBe(2)
    await panel.screenshot({path:info.outputPath(`auto-gift-preview-${locale}-${theme}.png`),animations:'disabled',style:'header.navbar, aside.admin-tools, .app-scroll-rail, .section-indicator {visibility:hidden!important}'})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.getByRole('button',{name:text('Save all','บันทึกทั้งหมด'),exact:true}).first().click()
    await page.getByRole('dialog',{name:text('Confirm save','ยืนยันการบันทึก')}).getByRole('button',{name:text('Confirm save','ยืนยันการบันทึก'),exact:true}).click()
    await expect.poll(()=>saved?.values.PRICE_READER_PRICING_MODE).toBe('AUTO')
    expect(saved?.values.PRICE_READER_OFFER_MODE).toBe('BOTH')
    const rules=saved?.values.PRICE_READER_COUNT_PRICE_RULES as Array<Record<string,unknown>>
    expect(rules).toHaveLength(50)
    expect(rules.filter(row=>row.giftPriceSatang!==undefined)).toEqual([{...providedRules.find(row=>row.itemCount===1&&row.pricingMode==='NITRO'&&row.discordPriceSatang===29500),giftPriceSatang:10000}])
    expect(saved?.secrets.GEMINI_API_KEY).toBeUndefined()
    await page.reload()
    await category(text('Quote options','รูปแบบเสนอราคา'))
    await expect(offers.locator('[data-gift-discord-price="29500"]').getByRole('spinbutton')).toHaveValue('100.00')
    await expect(offers.getByRole('combobox',{name:text('Price source','ราคาที่อ่านจากรูป'),exact:true})).toContainText(text('Auto · Nitro when visible','อัตโนมัติ · ใช้ Nitro เมื่อเห็นในรูป'))
    expect(calls).toBe(2)
    await page.goto(`/my-bot/fixture-bot/settings/packages/fixture-license/components-v2?locale=${locale}&message=result`)
    await expect(page.getByRole('heading',{name:/Components V2/}).first()).toBeVisible()
    await expect(page.locator('body')).toContainText(text('Ask for Gift price','สอบถามราคา Gift'))
    expect(calls).toBe(2)
  })
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { FeatureContext } from '../src/types.js';
import type { TicketCategory } from '../src/features/ticket/config.js';
import { ticketOpeningMessages } from '../src/features/ticket/messages.js';
const controls = () => new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('manage').setLabel('Manage').setStyle(ButtonStyle.Secondary));
test('topic welcome and answer cards share one post with controls after the answers in both formats', () => {
  for (const mode of ['EMBED','COMPONENTS_V2']) {
    const context = { presentations: { opened: { mode, embed: { title:'Shared' }, components_v2:{components:[{type:10,content:'Shared'}]} } } } as unknown as FeatureContext;
    const topic = { welcome: { title:'Purchase {{id}}', description:'Hello {{user}}', imageUrl:'https://example.com/banner.gif' } } as TicketCategory;
    const messages = ticketOpeningMessages(context,topic,{id:'00042',user:'Alice'},[{label:'Product',value:'VIP'}],controls());
    assert.equal(messages.length,1);
    const json = JSON.stringify(messages);
    assert.ok(json.indexOf('Purchase 00042') < json.indexOf('Product'));
    assert.ok(json.indexOf('Product') < json.indexOf('manage'));
    assert.match(json,/banner.gif/);
  }
});
test('large answers split safely instead of exceeding Discord limits or dropping content', () => {
  for (const mode of ['EMBED','COMPONENTS_V2']) {
    const context = { presentations: { opened: { mode, embed:{description:'a'.repeat(3500)}, components_v2:{components:[{type:10,content:'a'.repeat(3500)}]} } } } as unknown as FeatureContext;
    const messages = ticketOpeningMessages(context,{} as TicketCategory,{},Array.from({length:5},(_,i)=>({label:`Question ${i}`,value:'_'.repeat(1000)})),controls());
    assert.ok(messages.length > 1);
    const json=JSON.stringify(messages);
    for(let i=0;i<5;i++) assert.ok(json.includes(`Question ${i}`));
    assert.equal(messages.slice(0,-1).some(m=>JSON.stringify(m).includes('"custom_id":"manage"')),false);
  }
});
test('command-only welcomes near the V2 component limit never append an empty controls message', () => {
  const context = { presentations: { opened: { mode:'COMPONENTS_V2',components_v2:{ components:Array.from({length:39},(_,i)=>({type:10,content:`Line ${i}`})) } } } } as unknown as FeatureContext;
  const messages = ticketOpeningMessages(context,{} as TicketCategory,{},[]);
  assert.equal(messages.length,1);
  assert.equal(messages[0]!.components!.length,39);
});
test('direct welcome controls reserve room for all five buttons at the V2 component limit', () => {
  const context = { presentations: { opened: { mode:'COMPONENTS_V2',components_v2:{ components:Array.from({length:37},(_,i)=>({type:10,content:`Line ${i}`})) } } } } as unknown as FeatureContext;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(Array.from({length:5},(_,i)=>new ButtonBuilder().setCustomId(`action-${i}`).setLabel(`Action ${i}`).setStyle(ButtonStyle.Secondary)));
  const messages = ticketOpeningMessages(context,{} as TicketCategory,{},[],row);
  assert.equal(messages.length,2);
  assert.equal(messages[0]!.components!.length,37);
  assert.equal(messages[1]!.components!.length,1);
  assert.equal((messages[1]!.components![0] as ActionRowBuilder<ButtonBuilder>).components.length,5);
});

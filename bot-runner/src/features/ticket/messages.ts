import { MessageFlags, escapeMarkdown, type ActionRowBuilder, type ButtonBuilder, type MessageCreateOptions } from 'discord.js';
import type { FeatureContext } from '../../types.js';
import { renderTemplate } from '../presentation.js';
import type { TicketCategory } from './config.js';

type Block = Record<string, any>;
const componentCount = (rows: Block[]): number => rows.reduce((n,row) => n + 1 + componentCount(row.components ?? []), 0);
const componentText = (rows: Block[]): number => rows.reduce((n,row) => n + (row.type === 10 ? String(row.content ?? '').length : 0) + componentText(row.components ?? []), 0);
const embedText = (rows: Block[]): number => rows.reduce((n,row) => n + String(row.title ?? '').length + String(row.description ?? '').length + String(row.author?.name ?? '').length + String(row.footer?.text ?? '').length + (row.fields ?? []).reduce((sum: number,f: Block) => sum + String(f.name ?? '').length + String(f.value ?? '').length,0),0);

export function ticketOpeningMessages(context: FeatureContext, topic: TicketCategory, variables: Record<string,string>, answers: Array<{label:string;value:string}>, controls: ActionRowBuilder<ButtonBuilder>): MessageCreateOptions[] {
  let renderContext = context;
  if (topic.welcome) {
    const base = context.presentations.opened as Block;
    const color = (base?.mode === 'COMPONENTS_V2' ? base?.components_v2?.components?.find((row: Block) => row.type === 17)?.accent_color : base?.embed?.color) ?? base?.embed?.color ?? 5793266;
    const { title,description,imageUrl } = topic.welcome;
    const definition = base?.mode === 'COMPONENTS_V2'
      ? { mode:'COMPONENTS_V2',components_v2:{ components:[{type:17,accent_color:color,components:[
          {type:10,content:`## ${title}\n${description}`},
          ...(imageUrl?[{type:12,items:[{media:{url:imageUrl}}]}]:[]),
        ]}]}}
      : { mode:'EMBED',embed:{color,title,description,...(imageUrl?{image_url:imageUrl}:{})} };
    renderContext = { ...context, presentations:{...context.presentations,opened:definition} };
  }
  const base = renderTemplate(renderContext,'opened',variables);
  const v2 = base.flags === MessageFlags.IsComponentsV2;
  const key = v2?'components':'embeds';
  let current: Block = { ...base, [key]:[...((base[key] as Block[]) ?? [])] };
  const batches: Block[]=[];
  for (const answer of answers) {
    const text=`**${escapeMarkdown(answer.label)}**\n${escapeMarkdown(answer.value || '—')}`;
    const block=v2?{type:17,components:[{type:10,content:text}]}:{description:text,color:5793266};
    const rows=[...current[key],block];
    const exceeds=v2?(componentCount(rows)>38 || componentText(rows)>4000):(rows.length>10 || embedText(rows)>6000);
    if (exceeds) {
      batches.push(current);
      current=v2?{flags:MessageFlags.IsComponentsV2,components:[]}:{embeds:[]};
    }
    current[key].push(block);
  }
  if (v2 && componentCount(current.components)>38) {
    batches.push(current);
    current={flags:MessageFlags.IsComponentsV2,components:[]};
  }
  current.components=[...(current.components ?? []),controls];
  batches.push(current);
  return batches.map(payload => ({...payload,allowedMentions:{parse:[]}} as MessageCreateOptions));
}

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { EmbedBuilder, MessageFlags, type Client } from "discord.js";
import { memberSpendingFeature } from "../src/features/member-spending/v1.0.0.js";
import type { FeatureContext } from "../src/types.js";

const memberId = "222222222222222222";
const userAvatar = `https://cdn.discordapp.com/avatars/${memberId}/profile.png`;
const guildAvatar = `https://cdn.discordapp.com/guilds/111111111111111111/users/${memberId}/avatars/server.png`;
const defaultAvatar = "https://cdn.discordapp.com/embed/avatars/4.png";

async function addCard(options: {
  txCount: number;
  memberAvatar: string | null;
  userAvatar?: string;
  presentations?: Record<string, unknown>;
}) {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  const added: Array<{ id: string; amount: number }> = [];
  const replies: string[] = [];
  const user = {
    id: memberId,
    username: "Customer",
    displayAvatarURL: () => options.userAvatar ?? userAvatar,
  };
  const context = {
    client: client as unknown as Client,
    config: {},
    secrets: {},
    presentations: options.presentations ?? {},
    permissions: { canUse: () => true },
    memberSpending: {
      add: async (id: string, amount: number) => {
        added.push({ id, amount });
        return { memberDiscordId: id, amountSatang: 58000, txCount: options.txCount };
      },
    },
  } as unknown as FeatureContext;
  let completed!: () => void;
  const completion = new Promise<void>((resolve) => { completed = resolve; });
  const interaction = {
    commandName: "spending",
    user: {
      id: "333333333333333333",
      displayAvatarURL: () => "https://cdn.discordapp.com/avatars/333333333333333333/admin.png",
    },
    options: {
      getSubcommand: () => "add",
      getUser: () => user,
      getInteger: () => 160,
    },
    guild: {
      members: {
        fetch: async () => {
          if (options.memberAvatar === null) throw new Error("Member lookup failed");
          return { displayName: "Server Customer", displayAvatarURL: () => options.memberAvatar };
        },
      },
    },
    channel: {
      isTextBased: () => true,
      send: async (payload: Record<string, unknown>) => { sent.push(payload); },
    },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    isRepliable: () => true,
    inGuild: () => true,
    deferReply: async () => { interaction.deferred = true; },
    editReply: async (message: string) => { replies.push(message); completed(); },
  };
  const dispose = await memberSpendingFeature.activate(context);
  try {
    client.emit("interactionCreate", interaction);
    await completion;
    assert.deepEqual(added, [{ id: memberId, amount: 16000 }]);
    assert.deepEqual(replies, ["อัปเดตบัตรสะสมเรียบร้อย"]);
    assert.equal(sent.length, 1);
    return sent[0]!;
  } finally { await dispose(); }
}

const embedCard = { mode: "EMBED", embeds: [{ title: "{{member}}", thumbnail: { url: "{{avatar}}" } }] };

test("first spending card uses the selected customer's server avatar", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 1, memberAvatar: guildAvatar, presentations: { first_card: embedCard } });
  assert.deepEqual(card.embeds, [{ title: "Server Customer", thumbnail: { url: guildAvatar } }]);
});

test("returning spending card uses the selected customer's profile when member lookup fails", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, presentations: { returning_card: embedCard } });
  assert.deepEqual(card.embeds, [{ title: "Customer", thumbnail: { url: userAvatar } }]);
});

test("default spending card keeps the customer's own default avatar", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, userAvatar: defaultAvatar });
  const embed = (card.embeds as EmbedBuilder[])[0]!.toJSON();
  assert.equal(embed.thumbnail?.url, defaultAvatar);
  assert.match(embed.description!, /160\.00.*580\.00.*2/s);
});

test("Components V2 spending cards render the customer's avatar variable", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: guildAvatar, presentations: {
    returning_card: { mode: "COMPONENTS_V2", components: [{ type: 9, components: [{ type: 10, content: "{{member}}" }], accessory: { type: 11, media: { url: "{{avatar}}" } } }] },
  } });
  assert.equal(card.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(card.components, [{ type: 9, components: [{ type: 10, content: "Server Customer" }], accessory: { type: 11, media: { url: guildAvatar } } }]);
});

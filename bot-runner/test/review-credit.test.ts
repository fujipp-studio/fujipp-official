import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  ChannelType,
  Collection,
  type ChatInputCommandInteraction,
  type Client,
  type Message,
} from "discord.js";
import {
  buildReviewCreditCommand,
  shouldCountReviewMessage,
} from "../src/features/review-credit/v1.0.0.js";
import { reviewCreditFeatureV11 } from "../src/features/review-credit/v1.1.0.js";
import type { FeatureContext } from "../src/types.js";

type CountableMessage = Pick<Message, "author" | "webhookId">;

function message(
  authorIsBot: boolean,
  webhookId: string | null = null,
): CountableMessage {
  return { author: { bot: authorIsBot }, webhookId } as CountableMessage;
}

const channelId = "123456789012345";

function fixture(
  savedStates: Array<Record<string, unknown>>,
  fetchedMessages = new Collection<string, Message>(),
) {
  const renamedTo: string[] = [];
  const channel = {
    type: ChannelType.GuildText,
    name: "review",
    setName: async (name: string) => {
      renamedTo.push(name);
      channel.name = name;
    },
    messages: { fetch: async () => fetchedMessages },
    send: async () => ({ id: "reply" }),
  };
  class FakeClient extends EventEmitter {
    user = { id: "999999999999999" };
    channels = { fetch: async () => channel };
    application = { commands: { create: async () => ({ id: "command" }) } };
  }
  const client = new FakeClient();
  const permissionKeys: string[] = [];
  const context = {
    botId: "bot",
    installationId: "installation",
    guildId: "guild",
    client: client as unknown as Client,
    config: { REVIEW_CHANNEL_ID: channelId },
    runtimeState: { channelId, count: 3, lastReplyId: null, initialized: true },
    permissions: {
      canUse: (
        _interaction: ChatInputCommandInteraction,
        commandKey?: string,
      ) => {
        if (commandKey) permissionKeys.push(commandKey);
        return true;
      },
    },
    saveRuntimeState: async (state: Record<string, unknown>) => {
      savedStates.push(state);
    },
  } as unknown as FeatureContext;
  return { client, context, permissionKeys, renamedTo };
}

test("version 1.1 counts member and webhook reviews without counting normal bot messages", () => {
  assert.equal(shouldCountReviewMessage(message(false), true), true);
  assert.equal(
    shouldCountReviewMessage(message(true, "123456789012345"), true),
    true,
  );
  assert.equal(shouldCountReviewMessage(message(true), true), false);
});

test("version 1.0 keeps excluding webhook messages", () => {
  assert.equal(shouldCountReviewMessage(message(false)), true);
  assert.equal(
    shouldCountReviewMessage(message(true, "123456789012345")),
    false,
  );
});

test("version 1.1 adds an administrator subcommand for replacing the review count", () => {
  const command = buildReviewCreditCommand("review", true).toJSON();
  const setCount = command.options?.find(
    (option) => option.name === "set-count",
  );

  assert.deepEqual(
    command.options?.map((option) => option.name),
    ["recount", "set-count", "refresh"],
  );
  assert.equal(setCount?.options?.[0]?.name, "count");
  assert.equal(setCount?.options?.[0]?.required, true);
  assert.equal(setCount?.options?.[0]?.min_value, 0);
  assert.equal(setCount?.options?.[0]?.max_value, 2_147_483_647);
});

test("version 1.0 keeps its original command surface", () => {
  const command = buildReviewCreditCommand("review").toJSON();

  assert.deepEqual(
    command.options?.map((option) => option.name),
    ["recount", "refresh"],
  );
});

test("version 1.1 persists webhook messages as reviews", async () => {
  const savedStates: Array<Record<string, unknown>> = [];
  const { client, context } = fixture(savedStates);
  const stop = await reviewCreditFeatureV11.activate(context);
  client.emit("messageCreate", {
    author: { bot: true, id: "888888888888888" },
    webhookId: "777777777777777",
    channelId,
    guild: null,
    react: async () => undefined,
  } as unknown as Message);

  await stop();
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0]?.count, 4);
});

test("version 1.1 recount includes member and webhook reviews", async () => {
  const savedStates: Array<Record<string, unknown>> = [];
  const fetchedMessages = new Collection<string, Message>([
    ["member", message(false) as Message],
    ["webhook", message(true, "777777777777777") as Message],
    ["bot", message(true) as Message],
  ]);
  const { client, context, permissionKeys, renamedTo } = fixture(savedStates, fetchedMessages);
  const stop = await reviewCreditFeatureV11.activate(context);
  let completed!: () => void;
  const completion = new Promise<void>((resolve) => {
    completed = resolve;
  });
  const replies: string[] = [];
  const interaction = {
    commandName: "review",
    guildId: "guild",
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: { getSubcommand: () => "recount" },
    deferReply: async () => undefined,
    editReply: async (content: string) => {
      replies.push(content);
      completed();
    },
  } as unknown as ChatInputCommandInteraction;

  client.emit("interactionCreate", interaction);
  await completion;
  await stop();

  assert.equal(savedStates.at(-1)?.count, 2);
  assert.deepEqual(permissionKeys, ["review/recount"]);
  assert.deepEqual(renamedTo, ["꒰💯꒱┆review 〻2"]);
  assert.deepEqual(replies, ["นับและบันทึกรีวิวใหม่เรียบร้อย: 2 ข้อความ"]);
});

test("version 1.1 lets an administrator replace and persist the review count", async () => {
  const savedStates: Array<Record<string, unknown>> = [];
  const { client, context, permissionKeys, renamedTo } = fixture(savedStates);
  const stop = await reviewCreditFeatureV11.activate(context);
  let completed!: () => void;
  const completion = new Promise<void>((resolve) => {
    completed = resolve;
  });
  const replies: string[] = [];
  const interaction = {
    commandName: "review",
    guildId: "guild",
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getSubcommand: () => "set-count",
      getInteger: () => 250,
    },
    deferReply: async () => undefined,
    editReply: async (content: string) => {
      replies.push(content);
      completed();
    },
  } as unknown as ChatInputCommandInteraction;

  client.emit("interactionCreate", interaction);
  await completion;
  await stop();

  assert.equal(savedStates.at(-1)?.count, 250);
  assert.deepEqual(permissionKeys, ["review/set-count"]);
  assert.deepEqual(renamedTo, ["꒰💯꒱┆review 〻250"]);
  assert.deepEqual(replies, ["แก้ไขและบันทึกจำนวนรีวิวเรียบร้อย: 250 ข้อความ"]);
});

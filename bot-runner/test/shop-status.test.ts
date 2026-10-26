import { assertFeatureError } from "./assert-feature-error.js";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  Collection,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  type Client,
  type Interaction,
} from "discord.js";
import {
  readShopConfig,
  permissionPatch,
} from "../src/features/shop-status/config.js";
import { shopStatusFeature } from "../src/features/shop-status/v1.0.0.js";
import { renderTemplate } from "../src/features/presentation.js";
import { createCommandPermissionGate } from "../src/command-permissions.js";
import type { FeatureContext } from "../src/types.js";
const channelId = "111111111111111111",
  roleId = "222222222222222222";
const settle = () => new Promise((r) => setImmediate(r));
function fixture(config: Record<string, unknown> = {}) {
  const client = new EventEmitter() as EventEmitter & {
    application: unknown;
    isReady: () => boolean;
    guilds: unknown;
  };
  const registrations: any[] = [],
    deletes: string[] = [],
    states: any[] = [],
    errors: any[] = [],
    edits: any[] = [],
    messages: any[] = [],
    messageEdits: any[] = [],
    messageDeletes: string[] = [],
    renames: string[] = [];
  let canRename = true,
    failRename = false,
    thread = false;
  const fetchedChannels: any[] = [];
  let canMentionEveryone = true;
  const roles = new Collection([
    [roleId, { id: roleId, mentionable: false }],
    ["333333333333333333", { id: "333333333333333333", mentionable: false }],
  ]);
  const storedMessages = new Map<string, any>();
  let messageFailure: { operation: string; code: number } | undefined;
  let failAnnouncementSave = false;
  let failEdit = 0,
    failSend = false,
    failSave = false,
    missingRole = false,
    canManage = true,
    voice = false;
  const overwrites = new Collection<
    string,
    { allow: PermissionsBitField; deny: PermissionsBitField }
  >();
  overwrites.set(roleId, {
    allow: new PermissionsBitField([
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
    ]),
    deny: new PermissionsBitField([PermissionFlagsBits.ViewChannel]),
  });
  const permissions = {
    has: (flag: bigint) =>
      flag === PermissionFlagsBits.MentionEveryone
        ? canMentionEveryone
        : flag === PermissionFlagsBits.ManageRoles
          ? canManage
          : flag === PermissionFlagsBits.ManageChannels ||
              flag === PermissionFlagsBits.ManageThreads
            ? canRename
            : true,
  };
  const channel = {
    id: channelId,
    name: "announcements",
    setName: async (name: string) => {
      renames.push(name);
      channel.name = name;
      if (failRename && renames.length === 1)
        throw new Error("Rename failed after write");
      return channel;
    },
    isThread: () => thread,
    isDMBased: () => false,
    isVoiceBased: () => voice,
    isSendable: () => true,
    permissionsFor: () => permissions,
    messages: {
      fetch: async ({ message: id }: { message: string }) => {
        if (messageFailure?.operation === "fetch")
          throw { code: messageFailure.code };
        const message = storedMessages.get(id);
        if (!message) throw { code: 10008 };
        return message;
      },
    },
    send: async (payload: any) => {
      if (failSend) throw new Error("Cannot send");
      messages.push(payload);
      const id = String(900000000000000000n + BigInt(messages.length));
      const message = {
        id,
        author: { id: "bot" },
        webhookId: null,
        flags: {
          has: (flag: number) =>
            Boolean(Number(message.payload.flags ?? 0) & flag),
        },
        payload,
        edit: async (next: any) => {
          if (messageFailure?.operation === "edit")
            throw { code: messageFailure.code };
          messageEdits.push(next);
          message.payload = { ...message.payload, ...next };
          return message;
        },
        delete: async () => {
          if (messageFailure?.operation === "delete")
            throw { code: messageFailure.code };
          messageDeletes.push(id);
          storedMessages.delete(id);
        },
      };
      storedMessages.set(id, message);
      return message;
    },
    permissionOverwrites: {
      cache: overwrites,
      edit: async (id: string, patch: Record<string, boolean | null>) => {
        edits.push({ id, patch });
        if (edits.length === failEdit) throw new Error("Discord write failed");
        const overwrite = overwrites.get(id) ?? {
          allow: new PermissionsBitField(),
          deny: new PermissionsBitField(),
        };
        for (const [key, value] of Object.entries(patch)) {
          const bit =
            PermissionFlagsBits[key as keyof typeof PermissionFlagsBits];
          overwrite.allow.remove(bit);
          overwrite.deny.remove(bit);
          if (value === true) overwrite.allow.add(bit);
          if (value === false) overwrite.deny.add(bit);
        }
        overwrites.set(id, overwrite);
      },
    },
  };
  const guild = {
    id: "guild",
    name: "Server",
    channels: {
      fetch: async (...args: unknown[]) => {
        fetchedChannels.push(args);
        return channel;
      },
    },
    roles: {
      fetch: async (id?: string) =>
        id === undefined ? roles : missingRole ? null : roles.get(id),
    },
    members: { me: { id: "bot" } },
  };
  client.application = {
    commands: {
      fetch: async () => new Collection(registrations.map((c) => [c.id, c])),
      create: async (command: any) => {
        const c = { ...command, id: command.name };
        registrations.push(c);
        return c;
      },
      delete: async (id: string) => {
        deletes.push(id);
      },
    },
  };
  client.guilds = { fetch: async () => guild };
  client.isReady = () => true;
  const context = {
    client: client as unknown as Client,
    guildId: "guild",
    config,
    runtimeState: {},
    presentations: {
      shop_open: {
        mode: "EMBED",
        embed: { title: "{{status}}", description: "{{user_name}}" },
      },
      shop_close: {
        mode: "COMPONENTS_V2",
        components_v2: { components: [{ type: 10, content: "{{status}}" }] },
      },
    },
    permissions: createCommandPermissionGate(undefined),
    saveRuntimeState: async (state: any) => {
      if (failAnnouncementSave && state.announcement)
        throw new Error("Announcement state failed");
      if (failSave) throw new Error("State write failed");
      states.push(state);
    },
    reportFeatureError: async (...args: unknown[]) => {
      errors.push(args);
    },
  } as unknown as FeatureContext;
  function interaction(
    action = "open",
    options: {
      admin?: boolean;
      guildId?: string;
      commandId?: string;
      userRoles?: string[];
    } = {},
  ) {
    const replies: any[] = [];
    const command = String(config.SHOP_COMMAND_NAME ?? "shop");
    const value = {
      commandName: command,
      commandId: options.commandId ?? command,
      guildId: options.guildId ?? "guild",
      inGuild: () => true,
      isChatInputCommand: () => true,
      options: { getSubcommand: () => action },
      channel,
      channelId,
      user: { id: "user", displayName: "Alice" },
      member: { roles: options.userRoles ?? [] },
      memberPermissions: new PermissionsBitField(
        options.admin === false ? [] : [PermissionFlagsBits.Administrator],
      ),
      deferred: false,
      replied: false,
      reply: async (payload: any) => {
        value.replied = true;
        replies.push(payload);
      },
      deferReply: async (payload: any) => {
        value.deferred = true;
        replies.push({ ...payload, defer: true });
      },
      editReply: async (payload: any) => {
        replies.push(payload);
      },
    };
    return { value: value as unknown as Interaction, replies };
  }
  return {
    client,
    context,
    registrations,
    deletes,
    states,
    errors,
    edits,
    messages,
    messageEdits,
    messageDeletes,
    storedMessages,
    renames,
    channel,
    fetchedChannels,
    roles,
    setMentionPermission: (allowed: boolean) => {
      canMentionEveryone = allowed;
    },
    setRenamePermission: (allowed: boolean) => {
      canRename = allowed;
    },
    setFailRename: () => {
      failRename = true;
    },
    setThread: () => {
      thread = true;
    },
    setMessageFailure: (operation: string, code = 50013) => {
      messageFailure = { operation, code };
    },
    setFailAnnouncementSave: () => {
      failAnnouncementSave = true;
    },
    overwrites,
    interaction,
    setFailEdit: (n: number) => {
      failEdit = n;
    },
    setFailSend: (value = true) => {
      failSend = value;
    },
    setFailSave: () => {
      failSave = true;
    },
    setMissingRole: () => {
      missingRole = true;
    },
    setManage: (b: boolean) => {
      canManage = b;
    },
    setVoice: () => {
      voice = true;
    },
  };
}
const rules = [
  {
    channelId,
    roleId,
    open: { ViewChannel: "ALLOW", SendMessages: "INHERIT" },
    close: { ViewChannel: "DENY", SendMessages: "DENY" },
  },
];
test("validates commands, unique rules, permission allowlist and text", () => {
  assert.equal(readShopConfig({}).command, "shop");
  for (const invalid of [
    { SHOP_OPEN_DELIVERY_MODE: "invalid" },
    { SHOP_CLOSE_DELIVERY_MODE: ["UPDATE"] },
    { SHOP_COMMAND_NAME: "/shop" },
    { SHOP_OPEN_MESSAGE_TYPE: ["TEXT"] },
    {
      SHOP_PERMISSION_RULES: [
        { ...rules[0], open: { ViewChannel: ["ALLOW"] } },
      ],
    },
    { SHOP_OPEN_COMMAND: "same", SHOP_CLOSE_COMMAND: "same" },
    { SHOP_PERMISSION_RULES: [...rules, ...rules] },
    { SHOP_PERMISSION_RULES: [{}] },
    {
      SHOP_PERMISSION_RULES: [
        { ...rules[0], open: { Administrator: "ALLOW" } },
      ],
    },
    {
      SHOP_PERMISSION_RULES: [{ ...rules[0], close: { ViewChannel: "typo" } }],
    },
    { SHOP_OPEN_MESSAGE_TYPE: "TEXT", SHOP_OPEN_TEXT: " " },
    { SHOP_CLOSE_TEXT: "x".repeat(2001) },
    { SHOP_ANNOUNCEMENT_CHANNEL_ID: "invalid" },
  ])
    assert.throws(() => readShopConfig(invalid));
  assert.deepEqual(
    permissionPatch({
      ViewChannel: "DENY",
      SendMessages: "INHERIT",
      Connect: "KEEP",
    }),
    { ViewChannel: false, SendMessages: null },
  );
});
test("registers custom commands and removes previously owned command", async () => {
  const f = fixture({
    SHOP_COMMAND_NAME: "store",
    SHOP_OPEN_COMMAND: "start",
    SHOP_CLOSE_COMMAND: "stop",
  });
  f.context.runtimeState = {
    commandId: "old",
    commandName: "old",
    status: "close",
  };
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  assert.equal(f.registrations[0].name, "store");
  assert.deepEqual(
    f.registrations[0].options.map((s: any) => s.name),
    ["start", "stop"],
  );
  assert.deepEqual(f.deletes, ["old"]);
  assert.equal(f.states[0].status, "close");
  f.client.emit("interactionCreate", f.interaction("start").value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.equal(f.states.at(-1).status, "open");
  await dispose();
  assert.equal(f.client.listenerCount("interactionCreate"), 0);
});
test("never overwrites another feature's command or handles its interaction", async () => {
  const f = fixture();
  f.registrations.push({ id: "other-feature", name: "shop" });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  assert.equal(f.registrations.length, 1);
  assert.equal(f.errors[0][0], "SHOP_COMMAND_FAILED");
  const i = f.interaction("open", { commandId: "other-feature" });
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.equal(f.messages.length, 0);
  assert.equal(i.replies.length, 0);
  await dispose();
});
test("enforces guild, admin access, and per-subcommand role grants", async () => {
  const f = fixture();
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  for (const options of [{ admin: false }, { guildId: "other-guild" }]) {
    f.client.emit("interactionCreate", f.interaction("open", options).value);
    await settle();
  }
  assert.equal(f.messages.length, 0);
  f.context.permissions = createCommandPermissionGate({
    COMMAND_PERMISSION_RULES: [
      { command: "shop/open", roleIds: [roleId], userIds: [] },
    ],
  });
  f.client.emit(
    "interactionCreate",
    f.interaction("open", { admin: false, userRoles: [roleId] }).value,
  );
  await settle();
  assert.equal(f.messages.length, 1);
  f.client.emit(
    "interactionCreate",
    f.interaction("close", { admin: false, userRoles: [roleId] }).value,
  );
  await settle();
  assert.equal(f.messages.length, 1);
  await dispose();
});
test("open/close preserve unrelated bits; sends embed/components with private acknowledgments", async () => {
  const f = fixture({ SHOP_PERMISSION_RULES: rules });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const open = f.interaction();
  f.client.emit("interactionCreate", open.value);
  await settle();
  assert.deepEqual(f.edits[0].patch, { ViewChannel: true, SendMessages: null });
  assert.equal(
    f.overwrites.get(roleId)?.allow.has(PermissionFlagsBits.AttachFiles),
    true,
  );
  assert.deepEqual(f.messages[0].embeds, [
    { title: "เปิดร้าน", description: "Alice" },
  ]);
  assert.equal(open.replies[0].flags, MessageFlags.Ephemeral);
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.deepEqual(f.edits[1].patch, {
    ViewChannel: false,
    SendMessages: false,
  });
  assert.equal(f.messages[1].flags, MessageFlags.IsComponentsV2);
  assert.equal(f.states.at(-1).status, "close");
  await dispose();
});
test("plain text renders variables without mentions and no rules makes no writes", async () => {
  const f = fixture({
    SHOP_OPEN_MESSAGE_TYPE: "TEXT",
    SHOP_OPEN_TEXT: "{{status}} {{user}} {{guild_name}}",
  });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  assert.deepEqual(f.messages[0], {
    content: "เปิดร้าน <@user> Server",
    allowedMentions: { parse: [] },
  });
  assert.equal(f.edits.length, 0);
  await dispose();
});
test("preflight catches missing role, missing Manage Roles, and Connect on text before writes", async () => {
  for (const scenario of ["role", "permission", "voice"]) {
    const f = fixture({
      SHOP_PERMISSION_RULES:
        scenario === "voice"
          ? [{ channelId, roleId, open: { Connect: "DENY" }, close: {} }]
          : rules,
    });
    if (scenario === "role") f.setMissingRole();
    if (scenario === "permission") f.setManage(false);
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    const i = f.interaction();
    f.client.emit("interactionCreate", i.value);
    await settle();
    assert.equal(f.edits.length, 0);
    assert.equal(f.messages.length, 0);
    assert.equal(f.states.length, 1);
    assert.match(assertFeatureError(i.replies.at(-1), "Shop Status").title, /ไม่สำเร็จ/);
    await dispose();
  }
});
test("voice rules change Connect independently", async () => {
  const f = fixture({
    SHOP_PERMISSION_RULES: [
      {
        channelId,
        roleId,
        open: { Connect: "ALLOW" },
        close: { Connect: "DENY" },
      },
    ],
  });
  f.setVoice();
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.deepEqual(f.edits[0].patch, { Connect: false });
  await dispose();
});
test("failed Discord writes or state saves restore old bits and never announce success", async () => {
  for (const failState of [false, true]) {
    const f = fixture({
      SHOP_PERMISSION_RULES: [
        ...rules,
        {
          channelId,
          roleId: "333333333333333333",
          open: { ViewChannel: "DENY" },
          close: {},
        },
      ],
    });
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    if (failState) f.setFailSave();
    else f.setFailEdit(2);
    f.client.emit("interactionCreate", f.interaction().value);
    await settle();
    assert.equal(f.messages.length, 0);
    assert.equal(f.states.length, 1);
    assert.equal(f.edits.length, 4);
    assert.equal(
      f.overwrites.get(roleId)?.allow.has(PermissionFlagsBits.SendMessages),
      true,
    );
    assert.equal(
      f.overwrites.get(roleId)?.deny.has(PermissionFlagsBits.ViewChannel),
      true,
    );
    assert.equal(
      f.overwrites.get(roleId)?.allow.has(PermissionFlagsBits.AttachFiles),
      true,
    );
    await dispose();
  }
});
test("send failure records changed status and reports announcement failure", async () => {
  const f = fixture({ SHOP_PERMISSION_RULES: rules });
  f.setFailSend();
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const i = f.interaction();
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.equal(f.states.at(-1).status, "open");
  assert.equal(f.edits.length, 1);
  assert.match(assertFeatureError(i.replies.at(-1), "Shop Status", "SHOP_ANNOUNCEMENT_FAILED", true).description, /ปรับสิทธิ์แล้ว.*ส่งประกาศไม่สำเร็จ/);
  assert.equal(f.errors[0][0], "SHOP_ANNOUNCEMENT_FAILED");
  await dispose();
});
test("simultaneous commands cannot interleave writes", async () => {
  const f = fixture();
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const second = f.interaction("close");
  f.client.emit("interactionCreate", f.interaction().value);
  f.client.emit("interactionCreate", second.value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.match(assertFeatureError(second.replies[0], "Shop Status", "SHOP_BUSY").description, /กรุณารอ/);
  await dispose();
});

test("pending command deletion survives restart and is retried without losing ownership", async () => {
  const f = fixture();
  f.context.runtimeState = { commandId: "old-shop", commandName: "old-shop" };
  const commands = (
    f.client.application as {
      commands: { delete: (id: string) => Promise<void> };
    }
  ).commands;
  const remove = commands.delete;
  commands.delete = async () => {
    throw new Error("Discord unavailable");
  };
  const first = await shopStatusFeature.activate(f.context);
  await settle();
  assert.equal(f.states.at(-1).previousCommandId, "old-shop");
  await first();
  f.context.runtimeState = f.states.at(-1);
  commands.delete = remove;
  const second = await shopStatusFeature.activate(f.context);
  await settle();
  assert.deepEqual(f.deletes, ["old-shop"]);
  assert.equal(f.states.at(-1).previousCommandId, undefined);
  assert.equal(f.states.at(-1).commandId, "shop");
  await second();
});

test("a private confirmation failure never repeats a successful status change or announcement", async () => {
  const f = fixture();
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const i = f.interaction();
  (i.value as unknown as { editReply: () => Promise<void> }).editReply =
    async () => {
      throw new Error("Acknowledgment failed");
    };
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.equal(f.states.at(-1).status, "open");
  assert.deepEqual(
    f.errors.map((e) => e[0]),
    ["SHOP_ACK_FAILED"],
  );
  await dispose();
});

test("updates the latest announcement across open/close and restart, clearing old content", async () => {
  const f = fixture({
    SHOP_OPEN_DELIVERY_MODE: "UPDATE",
    SHOP_CLOSE_DELIVERY_MODE: "UPDATE",
  });
  let dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  const reference = f.states.at(-1).announcement;
  assert.equal(f.messages.length, 1);
  await dispose();
  f.context.runtimeState = f.states.at(-1);
  dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.deepEqual(f.messageEdits[0], {
    content: null,
    embeds: [],
    components: [{ type: 10, content: "ปิดร้าน" }],
    attachments: [],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
  assert.deepEqual(f.states.at(-1).announcement, reference);
  // A V2 message cannot return to Embed: replace it instead.
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  assert.deepEqual(f.messageDeletes, [reference.messageId]);
  assert.equal(f.messages.length, 2);
  assert.notEqual(f.states.at(-1).announcement.messageId, reference.messageId);
  await dispose();
});

test("replacement deletes only the tracked shop announcement then records the new message", async () => {
  const f = fixture({ SHOP_CLOSE_DELIVERY_MODE: "REPLACE" });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  const previous = f.states.at(-1).announcement.messageId;
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.deepEqual(f.messageDeletes, [previous]);
  assert.equal(f.messages.length, 2);
  assert.notEqual(f.states.at(-1).announcement.messageId, previous);
  await dispose();
});

test("missing announcements and a changed destination create a new message", async () => {
  for (const changedChannel of [false, true]) {
    const f = fixture({ SHOP_OPEN_DELIVERY_MODE: "UPDATE" });
    f.context.runtimeState = {
      announcement: {
        channelId: changedChannel ? "other" : channelId,
        messageId: "missing",
      },
    };
    if (changedChannel) f.setMessageFailure("fetch"); // Never fetch in another channel.
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    f.client.emit("interactionCreate", f.interaction().value);
    await settle();
    assert.equal(f.messages.length, 1);
    assert.equal(f.errors.length, 0);
    await dispose();
  }
});

test("fetch, edit and delete failures do not send duplicate announcements", async () => {
  for (const operation of ["fetch", "edit", "delete"]) {
    const f = fixture({
      SHOP_OPEN_DELIVERY_MODE: operation === "delete" ? "REPLACE" : "UPDATE",
    });
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    f.client.emit("interactionCreate", f.interaction().value);
    await settle();
    f.setMessageFailure(operation);
    const next = f.interaction();
    f.client.emit("interactionCreate", next.value);
    await settle();
    assert.equal(f.messages.length, 1);
    assert.match(assertFeatureError(next.replies.at(-1), "Shop Status", "SHOP_ANNOUNCEMENT_FAILED", true).description, /ส่งประกาศไม่สำเร็จ/);
    assert.equal(f.errors.at(-1)[0], "SHOP_ANNOUNCEMENT_FAILED");
    await dispose();
  }
});

test("announcement tracking failure reports partial success without re-sending", async () => {
  const f = fixture({ SHOP_OPEN_DELIVERY_MODE: "UPDATE" });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.setFailAnnouncementSave();
  const next = f.interaction();
  f.client.emit("interactionCreate", next.value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.equal(f.errors.at(-1)[0], "SHOP_ANNOUNCEMENT_STATE_FAILED");
  assert.match(
    assertFeatureError(next.replies.at(-1), "Shop Status", "SHOP_ANNOUNCEMENT_STATE_FAILED", true).description,
    /ส่งประกาศแล้ว.*บันทึกตำแหน่งข้อความไม่สำเร็จ/,
  );
  await dispose();
});

test("updates replace obsolete Embed content when changing to plain text", async () => {
  const f = fixture({
    SHOP_CLOSE_DELIVERY_MODE: "UPDATE",
    SHOP_CLOSE_MESSAGE_TYPE: "TEXT",
    SHOP_CLOSE_TEXT: "Closed",
  });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.deepEqual(f.messageEdits[0], {
    content: "Closed",
    embeds: [],
    components: [],
    attachments: [],
    allowedMentions: { parse: [] },
  });
  await dispose();
});

test("never edits or deletes a message owned by another author", async () => {
  for (const mode of ["UPDATE", "REPLACE"]) {
    const f = fixture({ SHOP_CLOSE_DELIVERY_MODE: mode });
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    f.client.emit("interactionCreate", f.interaction().value);
    await settle();
    f.storedMessages.values().next().value.author.id = "someone-else";
    f.client.emit("interactionCreate", f.interaction("close").value);
    await settle();
    assert.equal(f.messages.length, 1);
    assert.equal(f.messageEdits.length, 0);
    assert.equal(f.messageDeletes.length, 0);
    assert.equal(f.errors.at(-1)[0], "SHOP_ANNOUNCEMENT_FAILED");
    await dispose();
  }
});

test("a message removed during editing is recreated; missing access is never treated as deletion", async () => {
  const f = fixture({ SHOP_CLOSE_DELIVERY_MODE: "UPDATE" });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  f.setMessageFailure("edit", 10008);
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messages.length, 2);
  assert.equal(f.errors.length, 0);
  await dispose();
});

test("replacement send failure can recover on the next action after deleting the old announcement", async () => {
  const f = fixture({ SHOP_CLOSE_DELIVERY_MODE: "REPLACE" });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  f.client.emit("interactionCreate", f.interaction().value);
  await settle();
  f.setFailSend(true);
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messageDeletes.length, 1);
  assert.equal(f.messages.length, 1);
  assert.equal(f.states.at(-1).status, "close");
  f.setFailSend(false);
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messages.length, 2);
  assert.equal(f.messageDeletes.length, 1);
  await dispose();
});

test("renames the announcement channel per state, skips unchanged names and optional blanks", async () => {
  const f = fixture({
    SHOP_OPEN_CHANNEL_NAME: "🟢・สถานะ・ร้านเปิด",
    SHOP_CLOSE_CHANNEL_NAME: "🔴・สถานะ・ร้านปิด",
  });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  for (const action of ["open", "open", "close"]) {
    const i = f.interaction(action);
    f.client.emit("interactionCreate", i.value);
    await settle();
    assert.equal(i.replies[0].defer, true);
    assert.match(i.replies.at(-1).content, /ส่งประกาศแล้ว/);
  }
  assert.deepEqual(f.renames, ["🟢・สถานะ・ร้านเปิด", "🔴・สถานะ・ร้านปิด"]);
  assert.deepEqual(f.fetchedChannels[0], [channelId, { force: true }]);
  assert.equal(f.messages.length, 3);
  await dispose();

  const optional = fixture({
    SHOP_OPEN_CHANNEL_NAME: "",
    SHOP_CLOSE_CHANNEL_NAME: "closed",
  });
  optional.setRenamePermission(false);
  const stop = await shopStatusFeature.activate(optional.context);
  await settle();
  optional.client.emit("interactionCreate", optional.interaction("open").value);
  await settle();
  assert.deepEqual(optional.renames, []);
  assert.equal(optional.messages.length, 1);
  await stop();
});

test("renames the configured announcement destination instead of the command channel", async () => {
  const destinationId = "333333333333333333";
  const f = fixture({
    SHOP_ANNOUNCEMENT_CHANNEL_ID: destinationId,
    SHOP_OPEN_CHANNEL_NAME: "open",
  });
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const i = f.interaction();
  // The interaction channel must never be renamed when another destination was configured.
  (i.value as any).channel = {
    setName: () => {
      throw new Error("Wrong channel");
    },
  };
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.deepEqual(f.fetchedChannels[0], [destinationId, { force: true }]);
  assert.deepEqual(f.renames, ["open"]);
  await dispose();
});

for (const thread of [false, true]) {
  test(`checks rename permission before changing permissions or announcements (thread=${thread})`, async () => {
    const f = fixture({
      SHOP_OPEN_CHANNEL_NAME: "open",
      SHOP_PERMISSION_RULES: rules,
    });
    if (thread) f.setThread();
    f.setRenamePermission(false);
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    const i = f.interaction();
    f.client.emit("interactionCreate", i.value);
    await settle();
    assert.match(
      assertFeatureError(i.replies.at(-1), "Shop Status").description,
      thread ? /Manage Threads/ : /Manage Channels/,
    );
    assert.deepEqual(f.edits, []);
    assert.deepEqual(f.renames, []);
    assert.deepEqual(f.messages, []);
    await dispose();
  });
}

for (const failure of ["rename", "save"] as const) {
  test(`restores the name and permission overrides after ${failure} failure`, async () => {
    const f = fixture({
      SHOP_OPEN_CHANNEL_NAME: "open",
      SHOP_PERMISSION_RULES: rules,
    });
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    if (failure === "rename") f.setFailRename();
    else f.setFailSave();
    const i = f.interaction();
    f.client.emit("interactionCreate", i.value);
    await settle();
    assert.deepEqual(f.renames, ["open", "announcements"]);
    assert.equal(f.channel.name, "announcements");
    assert.equal(
      f.overwrites.get(roleId)!.deny.has(PermissionFlagsBits.ViewChannel),
      true,
    );
    assert.equal(
      f.overwrites.get(roleId)!.allow.has(PermissionFlagsBits.SendMessages),
      true,
    );
    assert.equal(f.messages.length, 0);
    assert.match(assertFeatureError(i.replies.at(-1), "Shop Status").title, /ปรับสถานะร้านไม่สำเร็จ/);
    await dispose();
  });
}

test("validates optional announcement channel names and allows emoji and Thai", () => {
  assert.deepEqual(readShopConfig({}).channelNames, { open: "", close: "" });
  assert.equal(
    readShopConfig({ SHOP_CLOSE_CHANNEL_NAME: "🔴・สถานะ・ร้านปิด" })
      .channelNames.close,
    "🔴・สถานะ・ร้านปิด",
  );
  assert.equal(
    readShopConfig({ SHOP_OPEN_CHANNEL_NAME: "x".repeat(100) }).channelNames
      .open.length,
    100,
  );
  for (const state of ["OPEN", "CLOSE"]) {
    for (const name of [
      123,
      [],
      " ",
      "x".repeat(101),
      "open\nshop",
      "open\tshop",
    ])
      assert.throws(() =>
        readShopConfig({ [`SHOP_${state}_CHANNEL_NAME`]: name }),
      );
  }
});

test("mention options require explicit booleans", () => {
  for (const state of ["OPEN", "CLOSE"])
    for (const kind of ["EVERYONE", "ROLE"]) {
      const key = `SHOP_${state}_ALLOW_${kind}_MENTIONS`;
      for (const value of [true, false])
        assert.doesNotThrow(() => readShopConfig({ [key]: value }));
      for (const value of ["true", "false", 1, [], null])
        assert.throws(() => readShopConfig({ [key]: value }));
    }
});

for (const format of ["TEXT", "EMBED", "COMPONENTS_V2"]) {
  test(`shop ${format} mentions are opt-in per action; private replies and shared templates do not ping`, async () => {
    const f = fixture({
      SHOP_OPEN_ALLOW_EVERYONE_MENTIONS: true,
      SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS: false,
      SHOP_OPEN_MESSAGE_TYPE: format === "TEXT" ? "TEXT" : "DESIGNED",
      SHOP_CLOSE_MESSAGE_TYPE: format === "TEXT" ? "TEXT" : "DESIGNED",
      SHOP_OPEN_TEXT: "@here <@123456789012345678> <@&222222222222222222>",
      SHOP_CLOSE_TEXT: "@everyone",
    });
    f.context.presentations = Object.fromEntries(
      ["open", "close"].map((state) => [
        `shop_${state}`,
        {
          mode: format,
          embed: {
            content: "@here <@123456789012345678> <@&222222222222222222>",
            title: "Shop",
          },
          components_v2: {
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content:
                      "@everyone @here <@123456789012345678> <@&222222222222222222>",
                  },
                ],
              },
            ],
          },
        },
      ]),
    );
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    for (const action of ["open", "close"]) {
      const i = f.interaction(action);
      f.client.emit("interactionCreate", i.value);
      await settle();
      assert.deepEqual(i.replies.at(-1).allowedMentions, { parse: [] });
    }
    assert.deepEqual(f.messages[0].allowedMentions, { parse: ["everyone"] });
    assert.deepEqual(f.messages[1].allowedMentions, { parse: [] });
    if (format !== "TEXT")
      assert.deepEqual(
        renderTemplate(f.context, "shop_open", {}).allowedMentions,
        { parse: [] },
      );
    await dispose();
  });
}

for (const delivery of ["NEW", "UPDATE", "REPLACE"]) {
  test(`close pings stay independent from open pings with ${delivery} delivery`, async () => {
    const f = fixture({
      SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS: true,
      SHOP_CLOSE_DELIVERY_MODE: delivery,
    });
    const template = {
      mode: "COMPONENTS_V2",
      components_v2: { components: [{ type: 10, content: "@here" }] },
    };
    f.context.presentations = { shop_open: template, shop_close: template };
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    for (const action of ["open", "close"]) {
      f.client.emit("interactionCreate", f.interaction(action).value);
      await settle();
    }
    assert.deepEqual(f.messages[0].allowedMentions, { parse: [] });
    const payload = delivery === "UPDATE" ? f.messageEdits[0] : f.messages[1];
    assert.deepEqual(payload.allowedMentions, { parse: ["everyone"] });
    assert.equal(f.messageDeletes.length, delivery === "REPLACE" ? 1 : 0);
    await dispose();
  });
}

test("missing Mention Everyone is reported before status, name or permission changes", async () => {
  const f = fixture({
    SHOP_OPEN_ALLOW_EVERYONE_MENTIONS: true,
    SHOP_OPEN_CHANNEL_NAME: "open",
    SHOP_PERMISSION_RULES: rules,
  });
  f.setMentionPermission(false);
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const i = f.interaction();
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.match(assertFeatureError(i.replies.at(-1), "Shop Status").description, /Mention Everyone/);
  assert.deepEqual(i.replies.at(-1).allowedMentions, { parse: [] });
  assert.equal(f.states.at(-1).status, undefined);
  assert.deepEqual(f.renames, []);
  assert.deepEqual(f.edits, []);
  assert.deepEqual(f.messages, []);
  // A disabled action must continue to work without this extra permission.
  f.client.emit("interactionCreate", f.interaction("close").value);
  await settle();
  assert.equal(f.messages.length, 1);
  assert.deepEqual(f.messages[0].allowedMentions, { parse: [] });
  await dispose();
});

for (const format of ["TEXT", "EMBED", "COMPONENTS_V2"]) {
  test(`Role pings work without everyone pings in ${format}, scoped to the chosen action`, async () => {
    const f = fixture({
      SHOP_OPEN_ALLOW_ROLE_MENTIONS: true,
      SHOP_OPEN_MESSAGE_TYPE: format === "TEXT" ? "TEXT" : "DESIGNED",
      SHOP_OPEN_TEXT: `@here @everyone <@123456789012345678> <@&${roleId}> <@&${roleId}>`,
    });
    f.setMentionPermission(false);
    f.roles.get(roleId)!.mentionable = true;
    f.context.presentations = {
      shop_open: {
        mode: format,
        embed: {
          title: "Shop",
          content: `<@&${roleId}> @here <@123456789012345678>`,
        },
        components_v2: {
          components: [
            {
              type: 17,
              components: [
                {
                  type: 9,
                  components: [
                    {
                      type: 10,
                      content: `<@&${roleId}> @everyone <@123456789012345678> <@&${roleId}>`,
                    },
                  ],
                  accessory: {
                    type: 2,
                    style: 5,
                    label: "Website",
                    url: "https://example.com",
                  },
                },
              ],
            },
          ],
        },
      },
      shop_close: {
        mode: "COMPONENTS_V2",
        components_v2: {
          components: [{ type: 10, content: `<@&${roleId}> @everyone` }],
        },
      },
    };
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    for (const action of ["open", "close"]) {
      const i = f.interaction(action);
      f.client.emit("interactionCreate", i.value);
      await settle();
      assert.deepEqual(i.replies.at(-1).allowedMentions, { parse: [] });
    }
    assert.deepEqual(f.messages[0].allowedMentions, {
      parse: [],
      roles: [roleId],
    });
    assert.deepEqual(f.messages[1].allowedMentions, { parse: [] });
    await dispose();
  });
}

for (const delivery of ["NEW", "UPDATE", "REPLACE"]) {
  test(`Role and everyone pings coexist in ${delivery} delivery`, async () => {
    const f = fixture({
      SHOP_CLOSE_ALLOW_ROLE_MENTIONS: true,
      SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS: true,
      SHOP_CLOSE_DELIVERY_MODE: delivery,
    });
    const template = {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [{ type: 10, content: `<@&${roleId}> @here` }],
      },
    };
    f.context.presentations = { shop_open: template, shop_close: template };
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    for (const action of ["open", "close"]) {
      f.client.emit("interactionCreate", f.interaction(action).value);
      await settle();
    }
    assert.deepEqual(f.messages[0].allowedMentions, { parse: [] });
    const payload = delivery === "UPDATE" ? f.messageEdits[0] : f.messages[1];
    assert.deepEqual(payload.allowedMentions, {
      parse: ["everyone"],
      roles: [roleId],
    });
    await dispose();
  });
}

for (const problem of ["missing", "unmentionable"]) {
  test(`reports a ${problem} Role before making shop changes`, async () => {
    const f = fixture({
      SHOP_OPEN_ALLOW_ROLE_MENTIONS: true,
      SHOP_OPEN_MESSAGE_TYPE: "TEXT",
      SHOP_OPEN_TEXT: `<@&${roleId}>`,
      SHOP_OPEN_CHANNEL_NAME: "open",
      SHOP_PERMISSION_RULES: rules,
    });
    f.setMentionPermission(false);
    if (problem === "missing") f.roles.delete(roleId);
    const dispose = await shopStatusFeature.activate(f.context);
    await settle();
    const i = f.interaction();
    f.client.emit("interactionCreate", i.value);
    await settle();
    assert.match(
      assertFeatureError(i.replies.at(-1), "Shop Status").description,
      problem === "missing" ? /ไม่พบ Role/ : /ไม่อนุญาตให้แท็ก/,
    );
    assert.deepEqual(i.replies.at(-1).allowedMentions, { parse: [] });
    assert.deepEqual(f.messages, []);
    assert.deepEqual(f.renames, []);
    assert.deepEqual(f.edits, []);
    assert.equal(f.states.at(-1).status, undefined);
    await dispose();
  });
}

test("Role pings consider only message content and Text Displays, not Embed text or button labels", async () => {
  const f = fixture({
    SHOP_OPEN_ALLOW_ROLE_MENTIONS: true,
    SHOP_CLOSE_ALLOW_ROLE_MENTIONS: true,
  });
  f.setMentionPermission(false);
  f.roles.clear();
  f.context.presentations = {
    shop_open: {
      mode: "EMBED",
      embed: { title: `<@&${roleId}>`, description: `<@&${roleId}>` },
    },
    shop_close: {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: `<@&${roleId}>`,
                url: "https://example.com",
              },
            ],
          },
        ],
      },
    },
  };
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  for (const action of ["open", "close"]) {
    f.client.emit("interactionCreate", f.interaction(action).value);
    await settle();
  }
  assert.equal(f.messages.length, 2);
  assert.deepEqual(
    f.messages.map((m) => m.allowedMentions),
    [
      { parse: [], roles: [] },
      { parse: [], roles: [] },
    ],
  );
  await dispose();
});

test("rejects more than 100 distinct Role pings before applying shop changes", async () => {
  const f = fixture({ SHOP_OPEN_ALLOW_ROLE_MENTIONS: true });
  const text = Array.from(
    { length: 101 },
    (_, i) => `<@&${BigInt(roleId) + BigInt(i)}>`,
  ).join(" ");
  f.context.presentations = {
    shop_open: {
      mode: "COMPONENTS_V2",
      components_v2: { components: [{ type: 10, content: text }] },
    },
  };
  const dispose = await shopStatusFeature.activate(f.context);
  await settle();
  const i = f.interaction();
  f.client.emit("interactionCreate", i.value);
  await settle();
  assert.match(assertFeatureError(i.replies.at(-1), "Shop Status").description, /100 Role/);
  assert.deepEqual(f.messages, []);
  assert.equal(f.states.at(-1).status, undefined);
  await dispose();
});

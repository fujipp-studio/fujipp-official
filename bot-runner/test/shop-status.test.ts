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
    messageDeletes: string[] = [];
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
      flag !== PermissionFlagsBits.ManageRoles || canManage,
  };
  const channel = {
    id: channelId,
    isThread: () => false,
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
    channels: { fetch: async () => channel },
    roles: { fetch: async (id: string) => (missingRole ? null : { id }) },
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
    assert.match(i.replies.at(-1).content, /ไม่สำเร็จ/);
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
  assert.match(i.replies.at(-1).content, /ปรับสิทธิ์แล้ว.*ส่งประกาศไม่สำเร็จ/);
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
  assert.match(second.replies[0].content, /กรุณารอ/);
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
    assert.match(next.replies.at(-1).content, /ส่งประกาศไม่สำเร็จ/);
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
    next.replies.at(-1).content,
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

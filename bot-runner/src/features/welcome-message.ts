import type { GuildMember } from "discord.js";
import type { FeatureModule } from "../types.js";

export const welcomeMessageFeature: FeatureModule = {
  runtimeKey: "welcome-message",
  version: "1.0.0",
  intents: ["Guilds", "GuildMembers"],
  async activate(context) {
    const onMember = async (member: GuildMember) => {
      const channelId = context.config.CHANNEL_ID;
      if (typeof channelId !== "string") return;
      const channel = await context.client.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased() || !channel.isSendable()) return;

      const presentation = context.presentations.welcome_embed;
      const title = isRecord(presentation) && typeof presentation.title === "string"
        ? presentation.title.replaceAll("{{userMention}}", `<@${member.id}>`)
        : `Welcome <@${member.id}>`;
      await channel.send({ embeds: [{ title }] }).catch((error: unknown) => {
        console.error(`Welcome message failed for bot ${context.botId}:`, error);
      });
    };
    context.client.on("guildMemberAdd", onMember);
    return () => { context.client.off("guildMemberAdd", onMember); };
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

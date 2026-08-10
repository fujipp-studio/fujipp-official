import { PermissionFlagsBits, type ChatInputCommandInteraction, type ModalSubmitInteraction } from "discord.js";

interface CommandPermissionRule {
  command: string;
  roleIds: string[];
  userIds: string[];
}

export function createCommandPermissionGate(config: Readonly<Record<string, unknown>> | undefined) {
  const rules = readRules(config?.COMMAND_PERMISSION_RULES);
  return {
    canUse(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, commandKey = "", defaultAllowed = true): boolean {
      if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
      const command = normalize(commandKey || ("commandName" in interaction ? interaction.commandName : ""));
      const rule = rules.find((item) => item.command === command)
        ?? ("commandName" in interaction ? rules.find((item) => item.command === interaction.commandName.toLowerCase()) : undefined)
        ?? rules.find((item) => item.command === "*");
      if (!rule) return defaultAllowed;
      if (rule.userIds.includes(interaction.user.id)) return true;
      const memberRoles = interaction.member && "roles" in interaction.member
        ? interaction.member.roles
        : [];
      const roleIds = Array.isArray(memberRoles)
        ? memberRoles
        : memberRoles && typeof memberRoles === "object" && "cache" in memberRoles
          ? [...memberRoles.cache.keys()]
          : [];
      return rule.roleIds.some((roleId) => roleIds.includes(roleId));
    },
  };
}

function readRules(value: unknown): CommandPermissionRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const command = normalize(String(record.command ?? ""));
    if (!command) return [];
    return [{
      command,
      roleIds: discordIds(record.roleIds),
      userIds: discordIds(record.userIds),
    }];
  });
}

function discordIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).filter((item) => /^\d{15,30}$/.test(item))
    : [];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/^\//, "").replace(/\s+/g, "/");
}

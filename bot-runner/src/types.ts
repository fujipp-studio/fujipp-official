import type { Client, GatewayIntentsString } from "discord.js";

export interface RuntimeFeature {
  installationId: string;
  code: string;
  version: string;
  runtimeKey: string;
  configRevision: number;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  presentations: Record<string, unknown>;
}

export interface RuntimeBot {
  id: string;
  name: string;
  discordApplicationId: string | null;
  discordGuildId: string | null;
  discordToken: string;
  features: RuntimeFeature[];
}

export interface BootstrapResponse {
  revision: number;
  bots: RuntimeBot[];
}

export interface FeatureContext {
  botId: string;
  client: Client;
  config: Readonly<Record<string, unknown>>;
  secrets: Readonly<Record<string, string>>;
  presentations: Readonly<Record<string, unknown>>;
}

export interface FeatureModule {
  runtimeKey: string;
  intents: GatewayIntentsString[];
  activate(context: FeatureContext): Promise<() => void>;
}

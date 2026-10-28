import type { ChatInputCommandInteraction, Client, GatewayIntentsString, ModalSubmitInteraction } from "discord.js";

export interface RuntimeFeature {
  installationId: string;
  code: string;
  version: string;
  runtimeKey: string;
  configRevision: number;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  presentations: Record<string, unknown>;
  runtimeState: Record<string, unknown>;
}

export interface RuntimeBot {
  id: string;
  name: string;
  discordApplicationId: string | null;
  discordGuildId: string | null;
  discordToken: string;
  restartRevision: number;
  runtimeSubscription: RuntimeSubscription;
  features: RuntimeFeature[];
}

export interface RuntimeSubscription {
  id: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
}

export interface BootstrapResponse {
  revision: number;
  bots: RuntimeBot[];
}

export interface FeatureContext {
  botId: string;
  installationId: string;
  guildId: string | null;
  client: Client;
  config: Readonly<Record<string, unknown>>;
  secrets: Readonly<Record<string, string>>;
  presentations: Readonly<Record<string, unknown>>;
  runtimeState: Readonly<Record<string, unknown>>;
  runtimeSubscription: Readonly<RuntimeSubscription>;
  installedFeatureCodes: ReadonlySet<string>;
  permissions: {
    canUse(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, commandKey?: string, defaultAllowed?: boolean): boolean;
  };
  reportFeatureError(errorCode: string, error: unknown, options?: { recoverable: boolean }): Promise<void>;
  paymentVoucher?: (input: { memberDiscordId: string; giftUrl: string; paymentMessageId: string; expectedAmountSatang: number; idempotencyKey: string }) => Promise<VoucherRedemption>;
  saveRuntimeState(state: Record<string, unknown>): Promise<void>;
  wallet: {
    balance(memberDiscordId: string): Promise<{ balanceSatang: number; currency: string }>;
    voucher(input: { memberDiscordId: string; giftUrl: string; idempotencyKey: string }): Promise<WalletTopupResult>;
    createPromptPay(memberDiscordId: string, amountSatang: number): Promise<PromptPaySession>;
    verifySlip(input: { sessionId?: string; memberDiscordId: string; slipImageUrl: string; idempotencyKey: string }): Promise<WalletTopupResult>;
    adjust(input: { memberDiscordId: string; actorDiscordId: string; operation: WalletAdjustmentOperation; amountSatang: number; reason: string; idempotencyKey: string }): Promise<WalletAdjustmentResult>;
    history(memberDiscordId: string, limit: number): Promise<WalletHistory>;
    monthlySummary(memberDiscordId?: string): Promise<WalletMonthlySummary>;
    leaderboard(limit: number): Promise<WalletLeaderboard>;
  };
  robux: {
    begin(input: RobuxPayoutInput): Promise<RobuxPayoutJob>;
    claim(jobId: string): Promise<RobuxPayoutJob>;
    outcome(jobId: string, input: RobuxPayoutOutcome): Promise<{ jobId:string; status:string; result:Record<string,unknown> }>;
    refund(jobId: string, input: { errorCode:string; errorMessage:string }): Promise<RobuxPayoutRefund>;
    recoverable(): Promise<{ jobs:RobuxPayoutJob[] }>;
  };
  roleShop: {
    begin(input: RoleShopPurchaseInput): Promise<RoleShopPurchase>;
    claim(id: string): Promise<RoleShopPurchase>;
    complete(id: string, claimToken: string): Promise<RoleShopPurchase>;
    refund(id: string, claimToken: string, reason: string): Promise<RoleShopPurchase>;
    recoverable(): Promise<RoleShopPurchase[]>;
  };
  memberSpending: MemberSpendingStore;
}

export interface MemberSpendingMonthlySettings { enabled: boolean; startDay: number; }
export interface MemberSpendingEntry { memberDiscordId:string; amountSatang:number; txCount:number; thisMonthSatang?:number; thisMonthTxCount?:number; }
export interface MemberSpendingStore {
  add(memberDiscordId:string,deltaSatang:number,operationKey?:string):Promise<MemberSpendingEntry>;
  set(memberDiscordId:string,input:{amountSatang?:number;txCount?:number},operationKey?:string):Promise<MemberSpendingEntry>;
  get(memberDiscordId:string,month?:string):Promise<MemberSpendingEntry|null>;
  remove(memberDiscordId:string,operationKey?:string):Promise<boolean>;
  leaderboard(limit:number,month?:string):Promise<MemberSpendingEntry[]>;
  totals(month?:string):Promise<{amountSatang:number;txCount:number}>;
}

export interface VoucherRedemption { id: string; botId: string; memberDiscordId: string; status: string; amountSatang: number | null; reference: string | null; failureCode: string | null; failureMessage: string | null; }
export interface WalletTopupResult { transactionId: string; creditedSatang: number; balanceSatang: number; currency: string; method: string; created: boolean; completedAt: string; }
export interface PromptPaySession { sessionId: string; amountSatang: number; currency: string; accountName: string; qrUrl: string; expiresAt: string; qrImageDataUri?: string; }
export type WalletAdjustmentOperation = "ADD" | "REMOVE" | "SET";
export interface WalletAdjustmentResult { transactionId: string; adjustmentSatang: number; balanceSatang: number; currency: string; operation: WalletAdjustmentOperation; created: boolean; completedAt: string; }
export interface WalletHistoryEntry { transactionId:string; kind:string; amountSatang:number; balanceAfterSatang:number; method:string; reason:string; createdAt:string; }
export interface WalletHistory { entries:WalletHistoryEntry[]; currency:string; }
export interface WalletMonthlySummary { totalSatang:number; entryCount:number; memberCount:number; currency:string; }
export interface WalletLeaderboardEntry { memberDiscordId:string; totalTopupSatang:number; entryCount:number; }
export interface WalletLeaderboard { entries:WalletLeaderboardEntry[]; currency:string; }
export interface RobuxPayoutInput { memberDiscordId:string; robloxUserId:number; robloxUsername:string; groupKey:string; groupId:number; robuxAmount:number; priceSatang:number; idempotencyKey:string; }
export interface RobuxPayoutJob extends RobuxPayoutInput { jobId:string; status:string; balanceSatang:number; created:boolean; createdAt:string; }
export interface RobuxPayoutOutcome { status:"SUCCEEDED"|"REVIEW_REQUIRED"; result:Record<string,unknown>; errorCode?:string; errorMessage?:string; }
export interface RobuxPayoutRefund { jobId:string; balanceSatang:number; created:boolean; status:string; }

export type FeatureDisposer = (() => void | Promise<void>) & {
  update?: (feature: RuntimeFeature) => Promise<void>;
};

export interface FeatureModule {
  runtimeKey: string;
  version: string;
  intents: GatewayIntentsString[];
  supportsHotReload?: boolean;
  activate(context: FeatureContext): Promise<FeatureDisposer>;
}

export interface RoleShopPurchaseInput { memberDiscordId: string; productKey: string; roleId: string; priceSatang: number; idempotencyKey: string; }
export interface RoleShopPurchase { id: string; memberDiscordId: string; productKey: string; productName: string; roleId: string; priceSatang: number; status: "DEBITED" | "PROCESSING" | "SUCCEEDED" | "REFUNDED"; balanceSatang: number; claimToken: string | null; createdAt: string; }

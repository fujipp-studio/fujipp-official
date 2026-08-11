import type { BootstrapResponse, PromptPaySession, WalletAdjustmentOperation, WalletAdjustmentResult, WalletTopupResult } from "./types.js";

export interface RuntimeApi {
  reportStatus(input: Parameters<RuntimeApiClient["reportStatus"]>[0]): Promise<void>;
  saveFeatureState(input: Parameters<RuntimeApiClient["saveFeatureState"]>[0]): Promise<void>;
  walletBalance: RuntimeApiClient["walletBalance"];
  walletVoucher: RuntimeApiClient["walletVoucher"];
  createPromptPay: RuntimeApiClient["createPromptPay"];
  verifySlip: RuntimeApiClient["verifySlip"];
  adjustWallet: RuntimeApiClient["adjustWallet"];
  walletHistory: RuntimeApiClient["walletHistory"];
  walletMonthlySummary: RuntimeApiClient["walletMonthlySummary"];
  walletLeaderboard: RuntimeApiClient["walletLeaderboard"];
  beginRobuxPayout: RuntimeApiClient["beginRobuxPayout"];
  claimRobuxPayout: RuntimeApiClient["claimRobuxPayout"];
  finishRobuxPayout: RuntimeApiClient["finishRobuxPayout"];
  refundRobuxPayout: RuntimeApiClient["refundRobuxPayout"];
  recoverableRobuxPayouts: RuntimeApiClient["recoverableRobuxPayouts"];
  addMemberSpending: RuntimeApiClient["addMemberSpending"];
  setMemberSpending: RuntimeApiClient["setMemberSpending"];
  getMemberSpending: RuntimeApiClient["getMemberSpending"];
  removeMemberSpending: RuntimeApiClient["removeMemberSpending"];
  memberSpendingLeaderboard: RuntimeApiClient["memberSpendingLeaderboard"];
  memberSpendingTotals: RuntimeApiClient["memberSpendingTotals"];
}

export class RuntimeApiClient implements RuntimeApi {
  private static readonly REQUEST_TIMEOUT_MS = 15_000;
  private bootstrapEtag: string | undefined;
  public constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  public async bootstrap(signal?: AbortSignal): Promise<BootstrapResponse | null> {
    const response = await this.fetch("/internal/v1/runtime/bootstrap", {
      method: "GET",
      headers: this.bootstrapEtag ? { "If-None-Match": this.bootstrapEtag } : {},
      ...(signal ? { signal } : {}),
    });
    if (response.status === 304) return null;
    await this.assertOk(response);
    this.bootstrapEtag = response.headers.get("ETag") ?? undefined;
    return (await response.json()) as BootstrapResponse;
  }

  public async reportStatus(input: {
    botId: string;
    installationId?: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
    discordUsername?: string;
    discordAvatarUrl?: string;
  }): Promise<void> {
    await this.request<void>("/internal/v1/runtime/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  public async saveFeatureState(input: {
    botId: string;
    installationId: string;
    state: Record<string, unknown>;
  }): Promise<void> {
    await this.request<void>("/internal/v1/runtime/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  public walletBalance(botId: string, memberDiscordId: string) {
    const query = new URLSearchParams({ botId, memberDiscordId });
    return this.request<{ balanceSatang: number; currency: string }>(`/internal/v1/wallet/balance?${query}`, { method: "GET" });
  }

  public walletVoucher(botId: string, input: { memberDiscordId: string; giftUrl: string; idempotencyKey: string }) {
    return this.request<WalletTopupResult>("/internal/v1/wallet/topups/truemoney", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId, ...input }) });
  }

  public createPromptPay(botId: string, memberDiscordId: string, amountSatang: number) {
    return this.request<PromptPaySession>("/internal/v1/wallet/topups/promptpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId, memberDiscordId, amountSatang }) });
  }

  public verifySlip(botId: string, input: { sessionId?: string; memberDiscordId: string; slipImageUrl: string; idempotencyKey: string }) {
    return this.request<WalletTopupResult>("/internal/v1/wallet/topups/slip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId, ...input }) });
  }

  public adjustWallet(botId: string, input: { memberDiscordId: string; actorDiscordId: string; operation: WalletAdjustmentOperation; amountSatang: number; reason: string; idempotencyKey: string }) {
    return this.request<WalletAdjustmentResult>("/internal/v1/wallet/adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId, ...input }) });
  }

  public walletHistory(botId:string,memberDiscordId:string,limit:number){const query=new URLSearchParams({botId,memberDiscordId,limit:String(limit)});return this.request<import("./types.js").WalletHistory>(`/internal/v1/wallet/history?${query}`,{method:"GET"});}
  public walletMonthlySummary(botId:string,memberDiscordId?:string){const query=new URLSearchParams({botId});if(memberDiscordId)query.set("memberDiscordId",memberDiscordId);return this.request<import("./types.js").WalletMonthlySummary>(`/internal/v1/wallet/monthly-summary?${query}`,{method:"GET"});}
  public walletLeaderboard(botId:string,limit:number){const query=new URLSearchParams({botId,limit:String(limit)});return this.request<import("./types.js").WalletLeaderboard>(`/internal/v1/wallet/leaderboard?${query}`,{method:"GET"});}
  public beginRobuxPayout(botId:string,input:import("./types.js").RobuxPayoutInput){return this.request<import("./types.js").RobuxPayoutJob>("/internal/v1/robux/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({botId,...input})});}
  public claimRobuxPayout(botId:string,jobId:string){const query=new URLSearchParams({botId});return this.request<import("./types.js").RobuxPayoutJob>(`/internal/v1/robux/jobs/${jobId}/claim?${query}`,{method:"POST"});}
  public finishRobuxPayout(botId:string,jobId:string,input:import("./types.js").RobuxPayoutOutcome){const query=new URLSearchParams({botId});return this.request<{jobId:string;status:string;result:Record<string,unknown>}>(`/internal/v1/robux/jobs/${jobId}/outcome?${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});}
  public refundRobuxPayout(botId:string,jobId:string,input:{errorCode:string;errorMessage:string}){const query=new URLSearchParams({botId});return this.request<import("./types.js").RobuxPayoutRefund>(`/internal/v1/robux/jobs/${jobId}/refund?${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});}
  public recoverableRobuxPayouts(botId:string){const query=new URLSearchParams({botId});return this.request<{jobs:import("./types.js").RobuxPayoutJob[]}>(`/internal/v1/robux/jobs/recoverable?${query}`,{method:"GET"});}

  public addMemberSpending(botId:string,memberDiscordId:string,deltaSatang:number){return this.request<import("./types.js").MemberSpendingEntry>("/internal/v1/member-spending/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({botId,memberDiscordId,deltaSatang})});}
  public setMemberSpending(botId:string,memberDiscordId:string,input:{amountSatang?:number;txCount?:number}){return this.request<import("./types.js").MemberSpendingEntry>("/internal/v1/member-spending",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({botId,memberDiscordId,...input})});}
  public getMemberSpending(botId:string,memberDiscordId:string){const query=new URLSearchParams({botId,memberDiscordId});return this.request<import("./types.js").MemberSpendingEntry|null>(`/internal/v1/member-spending?${query}`,{method:"GET"});}
  public removeMemberSpending(botId:string,memberDiscordId:string){const query=new URLSearchParams({botId,memberDiscordId});return this.request<boolean>(`/internal/v1/member-spending?${query}`,{method:"DELETE"});}
  public memberSpendingLeaderboard(botId:string,limit:number){const query=new URLSearchParams({botId,limit:String(limit)});return this.request<import("./types.js").MemberSpendingEntry[]>(`/internal/v1/member-spending/leaderboard?${query}`,{method:"GET"});}
  public memberSpendingTotals(botId:string){const query=new URLSearchParams({botId});return this.request<{amountSatang:number;txCount:number}>(`/internal/v1/member-spending/totals?${query}`,{method:"GET"});}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(path, init);
    await this.assertOk(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(RuntimeApiClient.REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    return fetch(new URL(path, this.baseUrl), {
      ...init,
      signal,
      headers: {
        ...init.headers,
        "X-Runner-Token": this.token,
      },
    });
  }

  private async assertOk(response: Response): Promise<void> {
    if (!response.ok) {
      const detail = await response.text();
      let message=`ระบบ Backend ตอบกลับ ${response.status}`;
      let code="RUNTIME_API_ERROR";
      try{const problem=JSON.parse(detail) as {detail?:unknown;code?:unknown};if(typeof problem.detail==="string")message=problem.detail;if(typeof problem.code==="string")code=problem.code;}catch{/* non-JSON response */}
      throw new RuntimeApiError(response.status,code,message);
    }
  }
}

export class RuntimeApiError extends Error {
  public constructor(public readonly status:number,public readonly code:string,message:string){super(message);this.name="RuntimeApiError";}
}

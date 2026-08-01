import type { BootstrapResponse } from "./types.js";

export class RuntimeApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  public async bootstrap(signal?: AbortSignal): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>("/internal/v1/runtime/bootstrap", {
      method: "GET",
      ...(signal ? { signal } : {}),
    });
  }

  public async reportStatus(input: {
    botId: string;
    installationId?: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.request<void>("/internal/v1/runtime/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        ...init.headers,
        "X-Runner-Token": this.token,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Runtime API ${response.status}: ${detail.slice(0, 300)}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

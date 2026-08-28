export function assertAppDataServerOnly(context = "app-data/client.server"): void {
  if (typeof window !== "undefined") {
    throw new Error(`@/lib/${context} is server-only.`);
  }
}

assertAppDataServerOnly("app-data/client.server");

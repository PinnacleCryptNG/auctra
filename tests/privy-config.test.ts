import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../lib/config";
import { privyAppConfigFromEnv, privyConfigFromEnv, PrivyNotConfiguredError } from "../lib/wallet/privy";

describe("Privy configuration (unit)", () => {
  it("sign-in needs only the app ID and app secret", () => {
    expect(privyAppConfigFromEnv({ NEXT_PUBLIC_PRIVY_APP_ID: "app", PRIVY_APP_SECRET: "secret" })).toEqual({ appId: "app", appSecret: "secret" });
  });

  it("names missing variables without echoing any values", () => {
    try {
      privyAppConfigFromEnv({ NEXT_PUBLIC_PRIVY_APP_ID: "visible-app-id" });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(PrivyNotConfiguredError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as PrivyNotConfiguredError).missing).toEqual(["PRIVY_APP_SECRET"]);
      expect((error as Error).message).not.toContain("visible-app-id");
    }
  });

  it("signing paths additionally require the authorization key", () => {
    expect(() => privyConfigFromEnv({ NEXT_PUBLIC_PRIVY_APP_ID: "app", PRIVY_APP_SECRET: "secret" })).toThrowError(
      expect.objectContaining({ missing: ["PRIVY_AUTHORIZATION_PRIVATE_KEY"] })
    );
  });
});

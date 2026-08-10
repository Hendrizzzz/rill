import { describe, expect, it } from "vitest";

import configJson from "../../vercel.json";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

interface VercelConfig {
  git: {
    deploymentEnabled: Record<string, boolean>;
  };
  headers: HeaderRule[];
}

const config = configJson as VercelConfig;

describe("Vercel deployment policy", () => {
  it("deploys main automatically without creating branch previews", () => {
    expect(config.git.deploymentEnabled).toEqual({
      "*": false,
      main: true,
    });
  });
});

describe("Vercel security headers", () => {
  it("applies the complete page security policy to both the root and nested routes", () => {
    const rootHeaders = config.headers.find(({ source }) => source === "/");
    const nestedHeaders = config.headers.find(
      ({ source }) => source === "/:path*",
    );

    expect(rootHeaders).toBeDefined();
    expect(nestedHeaders).toBeDefined();
    expect(rootHeaders?.headers).toEqual(nestedHeaders?.headers);
    expect(rootHeaders?.headers.map(({ key }) => key)).toEqual([
      "Content-Security-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]);
  });
});

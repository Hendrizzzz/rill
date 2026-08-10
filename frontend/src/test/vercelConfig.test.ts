import { describe, expect, it } from "vitest";
import { minimatch } from "minimatch";

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

function automaticDeploymentIsEnabled(branch: string): boolean {
  const matchingRules = Object.entries(config.git.deploymentEnabled).filter(
    ([pattern]) => minimatch(branch, pattern),
  );

  return matchingRules.length === 0 || matchingRules.some(([, enabled]) => enabled);
}

describe("Vercel deployment policy", () => {
  it("deploys main automatically", () => {
    expect(automaticDeploymentIsEnabled("main")).toBe(true);
  });

  it.each(["feature", "agent/fix", "release/2026/august"])(
    "suppresses automatic preview deployment for %s",
    (branch) => {
      expect(automaticDeploymentIsEnabled(branch)).toBe(false);
    },
  );

  it("keeps one broad deny rule and the explicit main override", () => {
    expect(config.git.deploymentEnabled).toEqual({
      "**": false,
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

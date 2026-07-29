import { describe, expect, it } from "vitest";

import {
  CODE_INDENT_WIDTH,
  leadingCodeIndentation,
  typableTarget,
} from "./targetText";

describe("typing target presentation", () => {
  it("uses the conventional four-column code indentation grid", () => {
    expect(CODE_INDENT_WIDTH).toBe(4);
  });

  it("separates structural indentation from the typable code", () => {
    expect(leadingCodeIndentation("        return value")).toBe(8);
    expect(typableTarget("        return value", "code")).toBe(
      "return value",
    );
  });

  it("leaves prose spacing untouched", () => {
    expect(typableTarget("  deliberate", "custom")).toBe("  deliberate");
  });
});

import { describe, expect, it } from "vitest";

import { codeSyntaxKinds } from "./codeSyntax";

function kindAt(
  line: string,
  token: string,
  language: Parameters<typeof codeSyntaxKinds>[1],
) {
  return codeSyntaxKinds(line, language)[line.indexOf(token)];
}

describe("code syntax presentation", () => {
  it("classifies language keywords, types, numbers, and literals", () => {
    const line = "const values: number[] = [1, true];";

    expect(kindAt(line, "const", "typescript")).toBe("keyword");
    expect(kindAt(line, "number", "typescript")).toBe("type");
    expect(kindAt(line, "1", "typescript")).toBe("number");
    expect(kindAt(line, "true", "typescript")).toBe("literal");
  });

  it("keeps comment markers inside strings out of the comment class", () => {
    const line = 'const path = "//value"; // note';
    const kinds = codeSyntaxKinds(line, "javascript");

    expect(kinds[line.indexOf('"') + 1]).toBe("string");
    expect(kinds[line.lastIndexOf("//")]).toBe("comment");
  });

  it("recognizes Python comments after code", () => {
    const line = "return value  # stable result";
    expect(kindAt(line, "return", "python3")).toBe("keyword");
    expect(kindAt(line, "#", "python3")).toBe("comment");
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const runtimeErrors = new WeakMap<Page, string[]>();

function activePromptWord(page: Page) {
  return page
    .locator(".prompt-word")
    .filter({ has: page.locator(".typing-caret") });
}

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
});

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

test("serves the expected source build", async ({ page }) => {
  await page.goto("/");
  const expectedBuildId = process.env.E2E_EXPECTED_BUILD_ID;
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-typethock-build-id", /^(source-[a-f0-9]{16}|[A-Za-z0-9._-]+)$/);
  if (expectedBuildId !== undefined) {
    await expect(html).toHaveAttribute("data-typethock-build-id", expectedBuildId);
  }
});

async function chooseTenWords(page: Page): Promise<string[]> {
  await page
    .getByRole("group", { name: "Test limit" })
    .getByRole("button", { name: "words", exact: true })
    .click();
  await page.getByRole("button", { name: "10", exact: true }).click();
  const words = await readPromptTargets(page);
  return words.slice(0, 10);
}

async function readPromptTargets(page: Page): Promise<string[]> {
  return page.locator(".prompt-word").evaluateAll((elements) =>
    elements.map(
      (element) => (element as HTMLElement).dataset.promptTarget ?? "",
    ),
  );
}

function persistableTypingDelay(text: string, minimumDelay = 30): number {
  return Math.max(
    minimumDelay,
    Math.ceil(1_200 / Math.max(1, text.length - 1)),
  );
}

async function completeTenWords(page: Page, minimumDelay = 30): Promise<void> {
  const words = await chooseTenWords(page);
  const text = words.join(" ");
  await page.getByRole("textbox", { name: "Typing input" }).pressSequentially(
    text,
    { delay: persistableTypingDelay(text, minimumDelay) },
  );
  await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
}

async function completeTenWordsRapidly(page: Page): Promise<void> {
  const words = await chooseTenWords(page);
  await page.getByRole("textbox", { name: "Typing input" }).pressSequentially(
    words.join(" "),
    { delay: 0 },
  );
  await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
}

test.describe("guest typing", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      return pathname.startsWith("/api/")
        ? route.abort("connectionrefused")
        : route.continue();
    });
  });

  test("completes, persists locally, and restarts from the keyboard", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        apiRequests.push(new URL(request.url()).pathname);
      }
    });
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByRole("textbox", { name: "Typing input" })).toBeFocused();

    await completeTenWords(page);
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    expect(apiRequests).toEqual(["/api/auth/session"]);
    expect(apiRequests).not.toContain("/api/results");
    await page.getByRole("button", { name: "change test" }).focus();
    await page.getByRole("button", { name: "change test" }).press("Enter");
    await expect(
      page
        .getByRole("group", { name: "Text source" })
        .getByRole("button", { name: "words", exact: true }),
    ).toBeFocused();

    await page.getByRole("link", { name: "history" }).click();
    await expect(page.getByRole("link", { name: "history" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("link", { name: "test", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
    const historyTable = page.getByRole("table", {
      name: "Guest typing results, newest first",
    });
    await expect(
      historyTable.getByRole("cell", { name: "words \u00b7 10", exact: true }),
    ).toBeVisible();
    const mobileTestLabel = historyTable
      .locator(".mobile-cell-label")
      .filter({ hasText: "Test" });
    await expect(mobileTestLabel).toHaveAttribute("aria-hidden", "true");
    if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 760) {
      await expect(mobileTestLabel).toBeVisible();
    }
    await page.reload();
    const reloadedTable = page.getByRole("table", {
      name: "Guest typing results, newest first",
    });
    await expect(
      reloadedTable.getByRole("cell", {
        name: "words \u00b7 10",
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: "test", exact: true }).click();
    await page.getByRole("textbox", { name: "Typing input" }).press("x");
    await expect(
      page
        .getByRole("group", { name: "Test limit" })
        .getByRole("button", { name: "words", exact: true }),
    ).toBeDisabled();
    await page.getByRole("textbox", { name: "Typing input" }).press("Escape");
    await expect(
      page
        .getByRole("group", { name: "Test limit" })
        .getByRole("button", { name: "words", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/Current word: .* Word 1 of 10\./)).toBeVisible();
  });

  test("shows exact subsecond stats but marks the run too short and does not save it", async ({
    page,
  }) => {
    await page.clock.install({
      time: new Date("2026-07-30T00:00:00.000Z"),
    });
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        apiRequests.push(new URL(request.url()).pathname);
      }
    });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: "Typing input" }),
    ).toBeFocused();
    const frozenAt = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(frozenAt + 10_000);

    await completeTenWordsRapidly(page);

    await expect(
      page.getByText("too short · not saved", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".result-details dd").filter({ hasText: /^0\.\d+s$/ }),
    ).toHaveCount(
      1,
    );
    expect(apiRequests).not.toContain("/api/results");
    await page.getByRole("link", { name: "history" }).click();
    await expect(page.getByText(/No saved runs yet\./)).toBeVisible();
  });

  test("restarts with Enter after inspecting the completed chart", async ({
    page,
  }) => {
    await page.goto("/");
    await completeTenWords(page, 30);
    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await scrubber.focus();
    await expect(scrubber).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("button", { name: "time", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Typing input" }),
    ).toBeFocused();
  });

  test(
    "keeps the typing origin fixed across source modes",
    async ({ page }, testInfo) => {
      const responsiveWidths =
        testInfo.project.name === "chromium"
          ? [1280, 768, 390, 320]
          : [undefined];

      for (const width of responsiveWidths) {
        if (width !== undefined) {
          await page.setViewportSize({ width, height: 900 });
        }
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const source = page.getByRole("group", { name: "Text source" });
        const firstCharacterTop = async () => {
          const bounds = await page
            .locator('[data-prompt-index="0"] .prompt-character')
            .first()
            .boundingBox();
          expect(bounds).not.toBeNull();
          return bounds?.y ?? 0;
        };

        const wordsTop = await firstCharacterTop();
        await source
          .getByRole("button", { name: "quote", exact: true })
          .click();
        const quoteTop = await firstCharacterTop();
        await source
          .getByRole("button", { name: "code", exact: true })
          .click();
        const codeTop = await firstCharacterTop();

        expect(Math.abs(quoteTop - wordsTop)).toBeLessThan(1);
        expect(Math.abs(codeTop - wordsTop)).toBeLessThan(1);
      }
    },
  );

  test("supports attributed quotes, private Spanish custom text, and strict errors", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/");

    await page.getByRole("button", { name: "quote", exact: true }).click();
    const attribution = page.locator(".prompt-attribution");
    await expect(attribution).toBeVisible();
    await expect(attribution.getByRole("link")).toHaveAttribute(
      "href",
      /^https:\/\//u,
    );
    const quote = await readPromptTargets(page);
    expect(quote.length).toBeGreaterThanOrEqual(2);
    await page
      .getByRole("textbox", { name: "Typing input" })
      .pressSequentially(quote.join(" "), { delay: 1 });
    await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();

    await page.getByRole("button", { name: "change test" }).click();
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await page.getByRole("button", { name: "Spanish" }).click();
    await page.getByRole("button", { name: "custom", exact: true }).click();
    await page.getByRole("button", { name: "use text" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Enter at least two words.",
    );
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await expect(page.getByLabel("Your practice text")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "custom", exact: true }).click();
    await expect(
      page.getByText("It stays in this tab and is never uploaded.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Your practice text")
      .fill("  cafe\u0301\n listo  ");
    await page.getByRole("button", { name: "use text" }).click();
    await expect(page.locator(".prompt-window")).toHaveAttribute("lang", "es");
    expect(await readPromptTargets(page)).toEqual(["café", "listo"]);
    await page
      .getByRole("textbox", { name: "Typing input" })
      .pressSequentially("café listo", { delay: 1 });
    await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
    const localValues = await page.evaluate(() =>
      Array.from(
        { length: localStorage.length },
        (_, index) => localStorage.getItem(localStorage.key(index) ?? "") ?? "",
      ).join("\n"),
    );
    expect(localValues).not.toContain("café listo");

    await page.getByRole("button", { name: "change test" }).click();
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await page.getByRole("button", { name: "10", exact: true }).click();
    await page.getByRole("button", { name: "strict", exact: true }).click();
    const [firstTarget, secondTarget, thirdTarget] = (
      await readPromptTargets(page)
    ).slice(0, 3);
    expect(firstTarget).toBeTruthy();
    expect(secondTarget).toBeTruthy();
    expect(thirdTarget).toBeTruthy();
    const wrongFirst =
      firstTarget?.startsWith("x")
        ? `y${firstTarget.slice(1)}`
        : `x${firstTarget?.slice(1) ?? ""}`;
    const input = page.getByRole("textbox", { name: "Typing input" });
    await input.pressSequentially(wrongFirst, { delay: 1 });
    await input.press("Space");
    await expect(page.locator("#current-target")).toContainText(
      `Current word: ${secondTarget ?? ""}.`,
    );
    await input.pressSequentially(secondTarget ?? "", { delay: 1 });
    await expect(
      page.locator(
        '[data-prompt-index="1"] .prompt-character.is-incorrect',
      ),
    ).toHaveCount(secondTarget?.length ?? 0);
    await expect(
      page.locator('[data-prompt-index="1"] .prompt-character.is-correct'),
    ).toHaveCount(0);
    await input.press("Space");
    await expect(page.locator("#current-target")).toContainText(
      `Current word: ${thirdTarget ?? ""}.`,
    );
    await input.press("Backspace");
    await expect(page.locator("#current-target")).toContainText(
      `Current word: ${secondTarget ?? ""}.`,
    );
    await input.press("Space");
    await input.press("Control+Backspace");
    await expect(page.locator("#current-target")).toContainText(
      `Current word: ${secondTarget ?? ""}.`,
    );
    await input.press("Control+Backspace");
    await expect(page.locator("#current-target")).toContainText(
      `Current word: ${firstTarget ?? ""}.`,
    );
    await input.pressSequentially(firstTarget ?? "", { delay: 1 });
    await input.press("Space");
    await input.pressSequentially(secondTarget ?? "", { delay: 1 });
    await expect(
      page.locator('[data-prompt-index="1"] .prompt-character.is-correct'),
    ).toHaveCount(secondTarget?.length ?? 0);
    await expect(
      page.locator(
        '[data-prompt-index="1"] .prompt-character.is-incorrect',
      ),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Strict errors are on; later input remains marked incorrect until all retained mistakes are corrected.",
        { exact: false },
      ),
    ).toBeAttached();
  });

  test("supports history navigation, direct loads, and unknown-route fallback", async ({
    page,
  }) => {
    await page.goto("/history");
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();

    const primaryNavigation = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    const testLink = primaryNavigation.getByRole("link", {
      name: "test",
      exact: true,
    });
    await expect(testLink).not.toHaveAttribute("aria-current", "page");
    await testLink.click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(testLink).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(/\/history$/);
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === "/");

    await page.goto("/not-a-route");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("textbox", { name: "Typing input" })).toBeFocused();
  });

  test("has no automated accessibility violations", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await expect(page.locator("#current-target")).not.toContainText(
      "seconds remaining",
    );
    const timer = page.getByRole("timer");
    await expect(timer).toHaveAttribute("aria-live", "off");
    await expect(timer).toContainText("seconds remaining");
    for (const theme of ["paper", "nocturne", "tide"]) {
      while ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await page.getByRole("button", { name: /Theme:/ }).click();
      }
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Theme: ${theme}`),
        }),
      ).toBeVisible();
      const initial = await new AxeBuilder({ page }).analyze();
      expect(initial.violations).toEqual([]);
    }

    await completeTenWords(page);
    const completed = await new AxeBuilder({ page }).analyze();
    expect(completed.violations).toEqual([]);

    await page.getByRole("link", { name: "history", exact: true }).click();
    const history = await new AxeBuilder({ page }).analyze();
    expect(history.violations).toEqual([]);

    await page.getByRole("button", { name: "account", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const accountDialog = await new AxeBuilder({ page }).analyze();
    expect(accountDialog.violations).toEqual([]);
  });

  test("reflows without horizontal overflow on a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "Typing input" })).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("button", { name: /Theme: nocturne/ })).toBeVisible();
    await page.getByRole("button", { name: /Theme: nocturne/ }).click();
    await expect(page.getByRole("button", { name: /Theme: tide/ })).toBeVisible();
  });

  test("keeps prompt type fixed and wraps it across the viewport matrix", async ({
    page,
  }) => {
    const viewports = [
      { width: 2560, height: 1080 },
      { width: 1920, height: 1080 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1365, height: 768 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 430, height: 932 },
      { width: 390, height: 844 },
      { width: 375, height: 667 },
      { width: 320, height: 568 },
    ];

    await page.goto("/");
    const appFrame = page.locator(".app-frame");
    const promptWindow = page.locator(".prompt-window");
    const firstPromptWord = page.locator(".prompt-word").first();
    await expect(appFrame).toBeVisible();
    await expect(promptWindow).toBeVisible();
    await expect(firstPromptWord).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(appFrame).toBeVisible();
      await expect(promptWindow).toBeVisible();
      await expect(firstPromptWord).toBeVisible();
      const layout = await page.evaluate(() => {
        const frame = document.querySelector<HTMLElement>(".app-frame");
        const header = document.querySelector<HTMLElement>(".site-header");
        const stageMain = document.querySelector<HTMLElement>(
          ".typing-stage-main",
        );
        const prompt = document.querySelector<HTMLElement>(".prompt-window");
        const words = Array.from(
          document.querySelectorAll<HTMLElement>(".prompt-word"),
        );
        if (
          frame === null ||
          header === null ||
          stageMain === null ||
          prompt === null
        ) {
          throw new Error("Typing layout is incomplete.");
        }

        const frameRect = frame.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const stageMainRect = stageMain.getBoundingClientRect();
        const promptRect = prompt.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          frameWidth: frameRect.width,
          frameLeft: frameRect.left,
          frameRight: window.innerWidth - frameRect.right,
          promptFontSize: getComputedStyle(prompt).fontSize,
          promptLeft: promptRect.left,
          promptRight: promptRect.right,
          stageMainLeft: stageMainRect.left,
          stageMainRight: stageMainRect.right,
          headerLeft: headerRect.left,
          headerRight: headerRect.right,
          wordRows: new Set(
            words.map((word) => Math.round(word.getBoundingClientRect().top)),
          ).size,
          wordsInBounds: words.every((word) => {
            const rect = word.getBoundingClientRect();
            return (
              rect.left >= promptRect.left - 1 &&
              rect.right <= promptRect.right + 1
            );
          }),
        };
      });

      expect(layout.documentWidth).toBe(layout.viewportWidth);
      expect(layout.promptFontSize).toBe("32px");
      expect(layout.wordsInBounds).toBe(true);
      expect(layout.wordRows).toBeGreaterThanOrEqual(2);
      expect(
        Math.abs(layout.promptLeft - layout.stageMainLeft),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(layout.promptRight - layout.stageMainRight),
      ).toBeLessThanOrEqual(1);
      expect(layout.frameWidth).toBeLessThanOrEqual(1600);
      expect(Math.abs(layout.frameLeft - layout.frameRight)).toBeLessThanOrEqual(
        1,
      );
    }
  });

  test("offers a line-aware, responsive code-learning test", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "code", exact: true })
      .click();

    const language = page.getByRole("combobox", { name: "Code language" });
    await expect(language).toHaveValue("python3");
    await expect(
      page.getByText("512 Python 3 drills · 32 concepts · 16 contexts"),
    ).toBeVisible();
    await expect(page.locator(".code-prompt-intro h2")).not.toBeEmpty();
    await expect(page.locator(".code-learning-notes > p")).not.toBeEmpty();
    await expect(page.locator(".code-learning-notes > small")).toContainText(
      "Assumes ",
    );
    await expect(page.locator(".code-learning-notes > small")).toBeVisible();
    await expect(page.locator(".code-prompt-facts")).toContainText(
      /O\(/u,
    );
    await expect(page.locator(".prompt-code-row")).toHaveCount(
      await page.locator(".prompt-word").count(),
    );
    await expect(page.locator(".prompt-window--code")).toHaveCSS(
      "font-size",
      "16px",
    );

    for (const option of [
      "cpp",
      "java",
      "python3",
      "c",
      "csharp",
      "javascript",
      "typescript",
      "go",
    ]) {
      await language.selectOption(option);
      await expect(language).toHaveValue(option);
      await expect(page.locator(".prompt-code-row").first()).toBeVisible();
      await expect(page.locator(".code-prompt-intro h2")).not.toBeEmpty();
    }

    await language.selectOption("python3");
    const firstLine =
      (await page
        .locator('[data-prompt-index="0"]')
        .getAttribute("data-prompt-target")) ?? "";
    expect(firstLine).not.toBe("");
    const firstSpaceIndex = Array.from(firstLine).indexOf(" ");
    expect(firstSpaceIndex).toBeGreaterThan(-1);
    const firstSpace = await page
      .locator('[data-prompt-index="0"] .prompt-slot')
      .nth(firstSpaceIndex)
      .boundingBox();
    expect(firstSpace?.width ?? 0).toBeGreaterThan(3);
    const input = page.getByRole("textbox", { name: "Typing input" });
    const firstLineCharacters = Array.from(firstLine);
    await input.pressSequentially(
      firstLineCharacters.slice(0, firstSpaceIndex).join(""),
      { delay: 1 },
    );
    await input.press("x");
    const incorrectSpace = page
      .locator('[data-prompt-index="0"] .prompt-slot')
      .nth(firstSpaceIndex)
      .locator(".prompt-character.is-incorrect.is-whitespace");
    await expect(incorrectSpace).toHaveCount(1);
    await expect(incorrectSpace).toHaveCSS("box-shadow", /rgb/u);
    for (const theme of ["paper", "nocturne", "tide"]) {
      while ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await page.getByRole("button", { name: /Theme:/ }).click();
      }
      const errorContrast = await incorrectSpace.evaluate((element) => {
        const parse = (color: string) =>
          (color.match(/\d+(?:\.\d+)?/g) ?? [])
            .slice(0, 3)
            .map((part) => Number(part) / 255);
        const luminance = (color: string) => {
          const [red = 0, green = 0, blue = 0] = parse(color).map((value) =>
            value <= 0.04045
              ? value / 12.92
              : Math.pow((value + 0.055) / 1.055, 2.4),
          );
          return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        const foreground = luminance(getComputedStyle(element).color);
        const surface = element.closest(".prompt-window--code");
        const background = luminance(
          getComputedStyle(surface ?? document.documentElement)
            .backgroundColor,
        );
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      });
      expect(errorContrast).toBeGreaterThanOrEqual(4.5);
      const activeErrorAccessibility = await new AxeBuilder({ page }).analyze();
      expect(activeErrorAccessibility.violations).toEqual([]);
    }
    await input.press("Backspace");
    await input.pressSequentially(
      firstLineCharacters.slice(firstSpaceIndex).join(""),
      { delay: 1 },
    );
    await expect(page.locator("#current-target")).toContainText("Line 1 of");
    await input.press("Enter");
    await expect(page.locator("#current-target")).toContainText("Line 2 of");
    await expect(page.locator("#current-target")).toContainText(
      "Current line, automatically indented 4 spaces:",
    );
    const secondRow = page.locator('.prompt-code-row[data-active="true"]');
    await expect(secondRow.locator(".prompt-code-indent")).toHaveAttribute(
      "data-indent-columns",
      "4",
    );
    const automaticIndentGeometry = await secondRow.evaluate((row) => {
      const indent = row.querySelector<HTMLElement>(".prompt-code-indent");
      const caret = row.querySelector<HTMLElement>(".typing-caret");
      if (indent === null || caret === null) return null;
      const indentBounds = indent.getBoundingClientRect();
      const caretBounds = caret.getBoundingClientRect();
      return {
        indentWidth: indentBounds.width,
        indentRight: indentBounds.right,
        caretLeft: caretBounds.left,
      };
    });
    expect(automaticIndentGeometry?.indentWidth ?? 0).toBeGreaterThan(30);
    expect(automaticIndentGeometry?.indentWidth ?? 0).toBeLessThan(50);
    expect(automaticIndentGeometry?.caretLeft ?? 0).toBeGreaterThanOrEqual(
      automaticIndentGeometry?.indentRight ?? Number.POSITIVE_INFINITY,
    );
    await expect(
      page.locator('[data-prompt-index="0"] .prompt-character.is-correct'),
    ).toHaveCount(Array.from(firstLine).length);

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".prompt-window--code")).toBeVisible();
      await expect(page.locator(".prompt-window--code")).toHaveCSS(
        "font-size",
        "16px",
      );
      const title = page.locator(".code-prompt-title h2");
      const lesson = page.locator(".code-learning-notes > p");
      const assumptions = page.locator(".code-learning-notes > small");
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText).not.toBeNull();
      await expect(title).toHaveAttribute("title", titleText ?? "");
      expect((await title.boundingBox())?.width ?? 0).toBeGreaterThan(80);
      await expect(lesson).toBeVisible();
      await expect(assumptions).toBeVisible();
      for (const note of [lesson, assumptions]) {
        expect(
          await note.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ).toBe(true);
      }
      const editorBounds = await page.locator(".code-workbench").boundingBox();
      expect(editorBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (editorBounds?.x ?? 0) + (editorBounds?.width ?? Number.POSITIVE_INFINITY),
      ).toBeLessThanOrEqual(viewport.width + 1);
    }

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await input.press("Tab");
    await expect(page.getByRole("button", { name: "Restart test" })).toBeFocused();
    await expect(page.locator(".typing-caret")).toHaveCount(0);
    await expect(page.locator(".code-workbench")).not.toHaveAttribute(
      "data-capture-focused",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await expect(page.locator(".typing-caret")).toHaveCount(1);
  });

  test("keeps a narrow code caret visible and persists a completed drill", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "code", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Code language" })
      .selectOption("python3");

    const lines = await readPromptTargets(page);
    expect(lines.length).toBeGreaterThanOrEqual(4);
    const codeTypingDelay = persistableTypingDelay(lines.join("\n"));
    const input = page.getByRole("textbox", { name: "Typing input" });
    await input.pressSequentially(lines[0] ?? "", {
      delay: codeTypingDelay,
    });
    await page.setViewportSize({ width: 320, height: 568 });

    await expect
      .poll(async () => {
        const geometry = await page.evaluate(() => {
          const prompt = document.querySelector<HTMLElement>(
            ".prompt-window--code",
          );
          const caret =
            prompt?.querySelector<HTMLElement>(".typing-caret") ?? null;
          if (prompt === null || caret === null) return null;
          const promptBounds = prompt.getBoundingClientRect();
          const caretBounds = caret.getBoundingClientRect();
          return {
            scrollLeft: prompt.scrollLeft,
            caretLeft: caretBounds.left,
            caretRight: caretBounds.right,
            promptLeft: promptBounds.left,
            promptRight: promptBounds.right,
          };
        });
        return (
          geometry !== null &&
          geometry.scrollLeft > 0 &&
          geometry.caretLeft >= geometry.promptLeft &&
          geometry.caretRight <= geometry.promptRight
        );
      })
      .toBe(true);
    const caretGeometry = await page.evaluate(() => {
      const prompt = document.querySelector<HTMLElement>(
        ".prompt-window--code",
      );
      const caret = prompt?.querySelector<HTMLElement>(".typing-caret") ?? null;
      if (prompt === null || caret === null) return null;
      const promptBounds = prompt.getBoundingClientRect();
      const caretBounds = caret.getBoundingClientRect();
      return {
        scrollLeft: prompt.scrollLeft,
        caretLeft: caretBounds.left,
        caretRight: caretBounds.right,
        promptLeft: promptBounds.left,
        promptRight: promptBounds.right,
      };
    });
    expect(caretGeometry).not.toBeNull();
    expect(caretGeometry?.scrollLeft ?? 0).toBeGreaterThan(0);
    expect(caretGeometry?.caretLeft ?? 0).toBeGreaterThanOrEqual(
      caretGeometry?.promptLeft ?? 0,
    );
    expect(
      caretGeometry?.caretRight ?? Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(caretGeometry?.promptRight ?? 0);

    await input.press("Enter");
    for (let index = 1; index < lines.length; index += 1) {
      await input.pressSequentially(lines[index] ?? "", {
        delay: codeTypingDelay,
      });
      if (index < lines.length - 1) {
        await input.press("Enter");
      }
    }

    await expect(page.getByRole("heading", { name: /^\d+$/u })).toBeVisible();
    await expect(
      page.getByText("Python 3 code · words per minute"),
    ).toBeVisible();
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "history" }).click();
    await expect(
      page.locator(".history-table tbody tr").first().locator("td").nth(1),
    ).toContainText(`${String(lines.length)} lines · code · Python 3`);
  });

  test("keeps keyboard focus, repeated correction, and paste handling predictable", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Test limit" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    const prompt = page.getByRole("button", { name: "Focus typing input" });
    const input = page.getByRole("textbox", { name: "Typing input" });

    await prompt.focus();
    await prompt.press("Enter");
    await expect(input).toBeFocused();
    await input.pressSequentially("ab");
    await expect(
      activePromptWord(page).locator(
        ".prompt-character.is-correct, .prompt-character.is-incorrect",
      ),
    ).toHaveCount(2);
    await input.dispatchEvent("keydown", {
      key: "Backspace",
      code: "Backspace",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    await expect(
      activePromptWord(page).locator(
        ".prompt-character.is-correct, .prompt-character.is-incorrect",
      ),
    ).toHaveCount(1);
    const pasteEvent = await input.evaluate((element) => {
      const event = new InputEvent("beforeinput", {
        inputType: "insertFromPaste",
        data: "pasted",
        bubbles: true,
        cancelable: true,
      });
      return {
        inputType: event.inputType,
        prevented: !element.dispatchEvent(event),
      };
    });
    expect(pasteEvent).toEqual({
      inputType: "insertFromPaste",
      prevented: true,
    });
    await expect(page.getByRole("status")).toContainText(
      "Paste is disabled during a test.",
    );
  });

  test("keeps prompt words fixed while typing within a visual row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const input = page.getByRole("textbox", { name: "Typing input" });
    const promptWindow = page.locator(".prompt-window");
    const targets = (await readPromptTargets(page)).slice(0, 14);
    const anchor = page.locator('[data-prompt-index="18"]');
    const before = await anchor.boundingBox();

    expect(before).not.toBeNull();
    await input.pressSequentially(`${targets.slice(0, 13).join(" ")} `, {
      delay: 1,
    });

    const after = await anchor.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1);
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(1);
    expect(await promptWindow.evaluate((element) => element.scrollTop)).toBe(0);
  });

  test("moves only by whole lines and resets the prompt viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const input = page.getByRole("textbox", { name: "Typing input" });
    const promptWindow = page.locator(".prompt-window");
    const words = page.locator(".prompt-word");
    const targets = await readPromptTargets(page);
    const rowStarts = await words.evaluateAll((elements) => {
      const starts: number[] = [];
      let previousTop: number | undefined;
      for (const element of elements) {
        const top = Math.round(element.getBoundingClientRect().top);
        if (previousTop === undefined || Math.abs(previousTop - top) > 1) {
          starts.push(Number((element as HTMLElement).dataset.promptIndex));
          previousTop = top;
        }
        if (starts.length === 4) {
          break;
        }
      }
      return starts;
    });
    const thirdRowStart = rowStarts[2] ?? -1;

    expect(thirdRowStart).toBeGreaterThan(1);
    await input.pressSequentially(
      `${targets.slice(0, thirdRowStart).join(" ")} `,
      { delay: 1 },
    );
    const atBoundary = await promptWindow.evaluate(
      (element) => element.scrollTop,
    );
    expect(atBoundary).toBeGreaterThan(0);

    await input.pressSequentially(`${targets[thirdRowStart] ?? ""} `, {
      delay: 1,
    });
    expect(await promptWindow.evaluate((element) => element.scrollTop)).toBe(
      atBoundary,
    );

    await input.press("Escape");
    await expect
      .poll(() => promptWindow.evaluate((element) => element.scrollTop))
      .toBe(0);
  });

  test("keeps target glyphs for errors, flows extras, and reopens imperfect words", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const input = page.getByRole("textbox", { name: "Typing input" });
    const activeWord = page.locator('[data-prompt-index="0"]');
    const nextWord = page.locator('[data-prompt-index="1"]');
    const target = (await activeWord.getAttribute("data-prompt-target")) ?? "";
    const before = await nextWord.boundingBox();
    const targetCharacters = Array.from(target);
    const beforeGlyphPositions = await activeWord
      .locator(".prompt-slot")
      .evaluateAll((slots) =>
        slots.map((slot) => slot.getBoundingClientRect().left),
      );
    const wrongGlyph =
      Array.from("qzxjkvbpdfghlmnrswty").find(
        (candidate) => !targetCharacters.includes(candidate),
      ) ?? "#";
    const glyphWidthSpread = await page
      .locator(".prompt-slot-measure")
      .evaluateAll((elements) => {
        const widths = elements.map(
          (element) => element.getBoundingClientRect().width,
        );
        return Math.max(...widths) - Math.min(...widths);
      });

    expect(before).not.toBeNull();
    expect(glyphWidthSpread).toBeGreaterThan(2);
    await input.pressSequentially(wrongGlyph.repeat(targetCharacters.length), {
      delay: 1,
    });

    const afterSubstitutions = await nextWord.boundingBox();
    const caretAtTargetEnd = await page
      .locator(".prompt-word .typing-caret")
      .boundingBox();
    const caretVerticalGeometry = await page
      .locator(".prompt-word .typing-caret")
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const caretStyle = getComputedStyle(element, "::before");
        const topGap = Number.parseFloat(caretStyle.top);
        const caretHeight = Number.parseFloat(caretStyle.height);
        return {
          topGap,
          bottomGap: bounds.height - topGap - caretHeight,
          caretHeight,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        };
      });
    const typedGeometry = await activeWord
      .locator(".prompt-slot")
      .evaluateAll((slots) =>
        slots.map((slot) => {
          const measure = slot.querySelector<HTMLElement>(
            ".prompt-slot-measure",
          );
          const visible = slot.querySelector<HTMLElement>(
            ".prompt-character",
          );
          const slotBounds = slot.getBoundingClientRect();
          const measureBounds = measure?.getBoundingClientRect();
          const visibleBounds = visible?.getBoundingClientRect();
          return {
            measureText: measure?.textContent ?? "",
            visibleText: visible?.textContent ?? "",
            slotWidth: slotBounds.width,
            measureWidth: measureBounds?.width ?? 0,
            visibleWidth: visibleBounds?.width ?? 0,
            left: visibleBounds?.left ?? 0,
            right: visibleBounds?.right ?? 0,
          };
        }),
      );
    expect(afterSubstitutions).not.toBeNull();
    expect(caretAtTargetEnd).not.toBeNull();
    expect(
      Math.abs(
        caretVerticalGeometry.topGap - caretVerticalGeometry.bottomGap,
      ),
    ).toBeLessThan(0.5);
    expect(caretVerticalGeometry.caretHeight).toBeGreaterThan(
      caretVerticalGeometry.fontSize,
    );
    expect(typedGeometry).toHaveLength(targetCharacters.length);
    expect(
      await activeWord.locator(".prompt-character.is-incorrect").count(),
    ).toBe(targetCharacters.length);
    expect(
      await activeWord
        .locator(".prompt-slot > .prompt-character.is-incorrect")
        .evaluateAll((elements) =>
          elements.map(
            (element) => getComputedStyle(element).textDecorationLine,
          ),
        ),
    ).toEqual(targetCharacters.map(() => "none"));
    for (const [index, glyph] of typedGeometry.entries()) {
      expect(glyph.measureText).toBe(glyph.visibleText);
      expect(glyph.visibleText).toBe(targetCharacters[index]);
      expect(glyph.visibleText).not.toBe(wrongGlyph);
      expect(
        Math.abs(glyph.left - (beforeGlyphPositions[index] ?? 0)),
      ).toBeLessThan(1);
      expect(Math.abs(glyph.slotWidth - glyph.visibleWidth)).toBeLessThan(1);
      expect(Math.abs(glyph.measureWidth - glyph.visibleWidth)).toBeLessThan(1);
    }
    for (let index = 1; index < typedGeometry.length; index += 1) {
      const previous = typedGeometry[index - 1];
      const current = typedGeometry[index];
      expect(Math.abs((current?.left ?? 0) - (previous?.right ?? 0))).toBeLessThan(
        1,
      );
    }
    expect(
      Math.abs((afterSubstitutions?.x ?? 0) - (before?.x ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((afterSubstitutions?.y ?? 0) - (before?.y ?? 0)),
    ).toBeLessThan(1);

    const extraText = wrongGlyph.repeat(8);
    await input.pressSequentially(extraText, { delay: 1 });
    const extras = activePromptWord(page).locator(".prompt-extras");
    const extrasBox = await extras.boundingBox();
    const afterExtras = await nextWord.boundingBox();
    const caretWithExtras = await page
      .locator(".prompt-word .typing-caret")
      .boundingBox();

    expect(await extras.locator(".is-extra").count()).toBe(extraText.length);
    await expect(extras).toHaveText(extraText);
    expect(extrasBox).not.toBeNull();
    expect(afterExtras).not.toBeNull();
    expect(caretWithExtras).not.toBeNull();
    expect(
      Math.abs((afterExtras?.x ?? 0) - (afterSubstitutions?.x ?? 0)) > 1 ||
        Math.abs((afterExtras?.y ?? 0) - (afterSubstitutions?.y ?? 0)) > 1,
    ).toBe(true);
    expect(
      (extrasBox?.x ?? 0) + (extrasBox?.width ?? 0) <=
          (afterExtras?.x ?? 0) + 1 ||
        (extrasBox?.y ?? 0) + (extrasBox?.height ?? 0) <=
          (afterExtras?.y ?? 0) + 1,
    ).toBe(true);
    expect(caretWithExtras?.x ?? 0).toBeGreaterThanOrEqual(
      (extrasBox?.x ?? 0) + (extrasBox?.width ?? 0) - 1,
    );

    for (let index = 0; index < extraText.length; index += 1) {
      await input.press("Backspace");
    }
    const afterCorrection = await nextWord.boundingBox();
    const caretAfter = await page
      .locator(".prompt-word .typing-caret")
      .boundingBox();
    expect(afterCorrection).not.toBeNull();
    expect(caretAfter).not.toBeNull();
    expect(
      Math.abs((afterCorrection?.x ?? 0) - (afterSubstitutions?.x ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((afterCorrection?.y ?? 0) - (afterSubstitutions?.y ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((caretAfter?.x ?? 0) - (caretAtTargetEnd?.x ?? 0)),
    ).toBeLessThan(1);

    await input.press("Space");
    expect(
      await activeWord
        .locator(".prompt-slot > .prompt-character")
        .allTextContents(),
    ).toEqual(targetCharacters);
    expect(
      await activeWord.locator(".prompt-character.is-incorrect").count(),
    ).toBe(targetCharacters.length);
    await expect(activeWord.locator(".typing-caret")).toHaveCount(0);
    await expect(nextWord.locator(".typing-caret")).toHaveCount(1);

    await input.press("Backspace");
    await expect(activeWord.locator(".typing-caret")).toHaveCount(1);
    await expect(nextWord.locator(".typing-caret")).toHaveCount(0);
    expect(
      await activeWord.locator(".prompt-character.is-incorrect").count(),
    ).toBe(targetCharacters.length);

    await input.press("Backspace");
    expect(
      await activeWord.locator(".prompt-character.is-incorrect").count(),
    ).toBe(targetCharacters.length - 1);
    expect(
      await activeWord.locator(".prompt-character.is-pending").count(),
    ).toBe(1);

    await input.press("Escape");
    const restartedFirstWord = page.locator('[data-prompt-index="0"]');
    const restartedSecondWord = page.locator('[data-prompt-index="1"]');
    const restartedTarget =
      (await restartedFirstWord.getAttribute("data-prompt-target")) ?? "";
    await input.pressSequentially(`${restartedTarget} `, { delay: 1 });
    await expect(restartedSecondWord.locator(".typing-caret")).toHaveCount(1);
    await input.press("Backspace");
    await expect(restartedSecondWord.locator(".typing-caret")).toHaveCount(1);
    await expect(restartedFirstWord.locator(".typing-caret")).toHaveCount(0);
  });

  test("reveals pace samples with pointer and keyboard exploration", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Test limit" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await page.getByRole("button", { name: "10", exact: true }).click();
    const targets = (await readPromptTargets(page)).slice(0, 10);
    await page
      .getByRole("textbox", { name: "Typing input" })
      .pressSequentially(targets.join(" "), { delay: 30 });
    await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
    await expect(page.locator("path.pace-line--wpm")).toHaveAttribute(
      "d",
      /\bC\b/,
    );
    await expect(
      page.getByLabel(/average raw pace \d+ words per minute; peak burst \d+/),
    ).toBeVisible();

    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await expect(scrubber).toHaveCount(1);
    const tooltip = page.getByTestId("pace-tooltip");
    const plot = page.locator(".pace-plot");
    const plotBox = await plot.boundingBox();
    expect(plotBox).not.toBeNull();
    if (plotBox !== null) {
      await page.mouse.move(
        plotBox.x + plotBox.width * 0.1,
        plotBox.y + plotBox.height * 0.5,
      );
    }
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("wpm");
    await expect(tooltip).toContainText("raw");
    await expect(tooltip).toContainText("burst");
    await expect(tooltip).toContainText("errors");
    const firstSample = await tooltip.textContent();

    if (plotBox !== null) {
      await page.mouse.move(
        plotBox.x + plotBox.width * 0.9,
        plotBox.y + plotBox.height * 0.5,
      );
    }
    await expect(tooltip).not.toHaveText(firstSample ?? "");
    const sampleTimes: string[] = [];
    const pointCount = await plot.locator(".pace-point").count();
    let previousTime = await tooltip.locator("p").textContent();
    for (let index = 0; index < pointCount; index += 1) {
      const pointBox = await plot.locator(".pace-point").nth(index).boundingBox();
      expect(pointBox).not.toBeNull();
      if (pointBox !== null) {
        await page.mouse.move(
          pointBox.x + pointBox.width / 2,
          pointBox.y + pointBox.height / 2,
        );
      }
      await expect(tooltip).toBeVisible();
      await expect(tooltip.locator("p")).not.toHaveText(previousTime ?? "");
      previousTime = await tooltip.locator("p").textContent();
      sampleTimes.push(previousTime ?? "");
      const currentBox = await tooltip.boundingBox();
      const currentViewport = page.viewportSize();
      expect(currentBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(currentBox?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (currentBox?.x ?? 0) +
          (currentBox?.width ?? Number.POSITIVE_INFINITY),
      ).toBeLessThanOrEqual(currentViewport?.width ?? 0);
      expect(
        (currentBox?.y ?? 0) +
          (currentBox?.height ?? Number.POSITIVE_INFINITY),
      ).toBeLessThanOrEqual(currentViewport?.height ?? 0);
    }
    expect(new Set(sampleTimes).size).toBe(pointCount);
    const tooltipBox = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    expect(tooltipBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(tooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (tooltipBox?.x ?? 0) + (tooltipBox?.width ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(tooltipBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (tooltipBox?.y ?? 0) +
        (tooltipBox?.height ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.height ?? 0);

    if (plotBox !== null) {
      await page.mouse.move(plotBox.x, Math.max(0, plotBox.y - 20));
    }
    await expect(tooltip).not.toBeVisible();

    await scrubber.focus();
    const maximum = Number(await scrubber.getAttribute("max"));
    await scrubber.press("End");
    await expect(scrubber).toHaveValue(String(maximum));
    await expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      /raw words per minute.*burst words per minute.*errors?/,
    );
    await expect(tooltip).toBeVisible();
    await scrubber.press("Home");
    await expect(scrubber).toHaveValue("0");
    if (maximum > 0) {
      await scrubber.press("ArrowRight");
      await expect(scrubber).toHaveValue("1");
      await scrubber.press("ArrowLeft");
      await expect(scrubber).toHaveValue("0");
    }
  });

  test("keeps a tiny terminal window from becoming a 500-WPM sample", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "typethock.guest-results.v2",
        JSON.stringify({
          version: 2,
          results: [
            {
              clientResultId: "pace-window-regression",
              mode: "words",
              modeValue: 10,
              punctuation: false,
              numbers: false,
              durationMs: 2_020,
              typedCharacters: 15,
              correctAttempts: 15,
              incorrectAttempts: 0,
              correctCharacters: 15,
              incorrectCharacters: 0,
              missingCharacters: 0,
              extraAttempts: 0,
              correctedErrors: 0,
              wpm: 89.11,
              rawWpm: 89.11,
              accuracy: 100,
              consistency: 100,
              paceBuckets: [
                {
                  durationMs: 1_000,
                  typedCharacters: 7,
                  correctCharacters: 7,
                  rawCharacters: 7,
                  errors: 0,
                },
                {
                  durationMs: 1_000,
                  typedCharacters: 7,
                  correctCharacters: 14,
                  rawCharacters: 14,
                  errors: 0,
                },
              ],
              completedAt: "2026-07-26T00:00:00Z",
              completionReason: "finished",
            },
          ],
        }),
      );
    });

    await page.goto("/history");
    await expect(
      page.locator(".pace-y-tick").filter({ hasText: /^500$/ }),
    ).toHaveCount(0);
    await expect(
      page.locator(".history-table tbody tr").first().locator("td").nth(4),
    ).toContainText("100.0%");

    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await expect(scrubber).toHaveAttribute("max", "1");
    await scrubber.focus();
    await scrubber.press("End");
    await expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "2 seconds, 84 words per minute, 84 raw words per minute, 84 burst words per minute, 0 errors",
    );
    await expect(page.getByTestId("pace-tooltip")).toContainText("2s");
    if (testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "output/playwright/pace-terminal-window-desktop.png",
        fullPage: true,
      });
    }
  });

  test("contains four-digit pace values on a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => {
      localStorage.setItem(
        "typethock.guest-results.v2",
        JSON.stringify({
          version: 2,
          results: [
            {
              clientResultId: "four-digit-pace-layout",
              mode: "words",
              modeValue: 10,
              punctuation: false,
              numbers: false,
              durationMs: 1_000,
              typedCharacters: 500,
              correctAttempts: 500,
              incorrectAttempts: 0,
              correctCharacters: 500,
              incorrectCharacters: 0,
              missingCharacters: 0,
              extraAttempts: 0,
              correctedErrors: 0,
              wpm: 6_000,
              rawWpm: 6_000,
              accuracy: 100,
              consistency: 100,
              paceBuckets: [
                {
                  durationMs: 1_000,
                  typedCharacters: 500,
                  correctCharacters: 500,
                  rawCharacters: 500,
                  errors: 0,
                },
              ],
              completedAt: "2026-07-26T00:00:00Z",
              completionReason: "finished",
            },
          ],
        }),
      );
    });

    await page.goto("/history");
    await expect(
      page.getByLabel(
        "average raw pace 6000 words per minute; peak burst 6000 words per minute",
      ),
    ).toBeVisible();

    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await scrubber.focus();
    await scrubber.press("End");
    const tooltip = page.getByTestId("pace-tooltip");
    await expect(tooltip).toContainText("6000");

    const tooltipBox = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    expect(tooltipBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(tooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(tooltipBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (tooltipBox?.x ?? 0) +
        (tooltipBox?.width ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(
      (tooltipBox?.y ?? 0) +
        (tooltipBox?.height ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.height ?? 0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("reveals a pace sample by touch", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Touch interaction is exercised by the touch-enabled project.",
    );

    await page.goto("/");
    await page
      .getByRole("group", { name: "Test limit" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await page.getByRole("button", { name: "10", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Typing input" });
    const prompt = (await readPromptTargets(page)).slice(0, 10).join(" ");
    await input.pressSequentially(prompt, { delay: 12 });

    const plot = page.locator(".pace-plot");
    await plot.scrollIntoViewIfNeeded();
    const plotBox = await plot.boundingBox();
    expect(plotBox).not.toBeNull();
    if (plotBox !== null) {
      await page.touchscreen.tap(
        plotBox.x + plotBox.width * 0.75,
        plotBox.y + plotBox.height * 0.5,
      );
    }

    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    const tooltip = page.getByTestId("pace-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      /raw words per minute.*burst words per minute.*errors?/,
    );
    const tooltipBox = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    expect(tooltipBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(tooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(tooltipBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (tooltipBox?.x ?? 0) +
        (tooltipBox?.width ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(
      (tooltipBox?.y ?? 0) +
        (tooltipBox?.height ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(viewport?.height ?? 0);
    await page.getByText("accuracy", { exact: true }).tap();
    await expect(page.getByTestId("pace-tooltip")).not.toBeVisible();
  });

  test("meets prompt contrast at mobile widths in every theme", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      for (const theme of ["paper", "nocturne", "tide"]) {
        while (
          (await page.getByRole("button", { name: /Theme:/ }).textContent()) !==
          theme
        ) {
          await page.getByRole("button", { name: /Theme:/ }).click();
        }
        const contrast = await page.locator(".prompt-window").evaluate((element) => {
          const parse = (color: string) =>
            (color.match(/\d+(?:\.\d+)?/g) ?? [])
              .slice(0, 3)
              .map((part) => Number(part) / 255);
          const luminance = (color: string) => {
            const [red = 0, green = 0, blue = 0] = parse(color).map((value) =>
              value <= 0.04045
                ? value / 12.92
                : Math.pow((value + 0.055) / 1.055, 2.4),
            );
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          };
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(
            getComputedStyle(document.documentElement).backgroundColor,
          );
          return (
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05)
          );
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("applies a saved dark theme before application startup", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("typethock.theme.v1", "nocturne");
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "nocturne");
  });

  test("traps modal focus and returns it to the account control", async ({
    page,
  }) => {
    await page.goto("/");
    const accountButton = page.getByRole("button", {
      name: "account",
      exact: true,
    });
    await accountButton.focus();
    await expect(accountButton).toBeFocused();
    expect(
      await accountButton.evaluate(
        (element) => getComputedStyle(element).boxShadow !== "none",
      ),
    ).toBe(true);

    await accountButton.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /close/ })).toBeFocused();
    await dialog.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(accountButton).toBeFocused();
  });

  test("keeps all primary states operable across the supported viewport matrix", async ({
    page,
  }) => {
    const viewports = [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1366, 768],
      [1440, 900],
      [1536, 864],
      [1920, 1080],
      [2560, 1080],
    ] as const;

    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(
        page.getByRole("textbox", { name: "Typing input" }),
      ).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const promptBox = await page
        .getByRole("button", { name: "Focus typing input" })
        .boundingBox();
      expect(promptBox?.width ?? 0).toBeGreaterThan(0);
      expect(promptBox?.height ?? 0).toBeGreaterThan(0);
    }
  });

  test("survives offline completion and reload without inventing a result", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const words = await chooseTenWords(page);
    const input = page.getByRole("textbox", { name: "Typing input" });
    await input.press(words[0]?.[0] ?? "a");
    await page.reload();
    await page.getByRole("link", { name: "history" }).click();
    await expect(page.getByText(/No saved runs yet\./)).toBeVisible();

    await page.getByRole("link", { name: "test", exact: true }).click();
    const freshWords = await chooseTenWords(page);
    const freshText = freshWords.join(" ");
    await context.setOffline(true);
    await page
      .getByRole("textbox", { name: "Typing input" })
      .pressSequentially(freshText, {
        delay: persistableTypingDelay(freshText),
      });
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    await context.setOffline(false);
  });

  test("isolates an active run from same-origin tab changes and route remounts", async ({
    page,
    context,
  }) => {
    await page.goto("/", { waitUntil: "commit" });
    const input = page.getByRole("textbox", { name: "Typing input" });
    await expect(input).toBeFocused();
    const words = await chooseTenWords(page);
    await input.press(words[0]?.[0] ?? "a");
    await expect(
      page
        .getByRole("group", { name: "Test limit" })
        .getByRole("button", { name: "words", exact: true }),
    ).toBeDisabled();

    const sibling = await context.newPage();
    await sibling.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      return pathname.startsWith("/api/")
        ? route.abort("connectionrefused")
        : route.continue();
    });
    await sibling.goto(new URL("/", page.url()).toString(), {
      waitUntil: "commit",
    });
    const siblingTheme = sibling.getByRole("button", { name: /Theme:/ });
    await expect(siblingTheme).toBeVisible();
    await siblingTheme.click();
    await sibling.getByRole("button", { name: "time", exact: true }).click();
    await sibling.close();

    await expect(
      page
        .getByRole("group", { name: "Test limit" })
        .getByRole("button", { name: "words", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
    await page.getByRole("link", { name: "history" }).click();
    await expect(page.getByText(/No saved runs yet\./)).toBeVisible();
    await page.goBack();
    await expect(input).toBeFocused();
    await expect(
      page.getByRole("button", { name: "time", exact: true }),
    ).toBeEnabled();
  });

  test("does not execute HTML-like typed input or add request work per keystroke", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        requests.push(request.url());
      }
    });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Typing input" });
    await expect(input).toBeVisible();
    await page.waitForLoadState("networkidle");
    const baseline = requests.length;
    await input.pressSequentially("<img src=x onerror=window.__typethockXss=1>", {
      delay: 1,
    });
    expect(
      await page.evaluate(() =>
        Object.prototype.hasOwnProperty.call(window, "__typethockXss"),
      ),
    ).toBe(false);
    await expect(page.locator(".prompt-window img")).toHaveCount(0);
    expect(requests.slice(baseline)).toEqual([]);
  });

  test("preserves graph focus and values through resize, theme, and reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await completeTenWords(page, 30);
    const scrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await scrubber.focus();
    await scrubber.press("End");
    const selected = await scrubber.getAttribute("aria-valuetext");
    const value = await scrubber.inputValue();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(scrubber).toBeFocused();
    const tooltip = page.getByTestId("pace-tooltip");
    await expect(tooltip).toBeVisible();
    const readTooltipGeometry = () =>
      page.evaluate(() => {
        const tooltipElement = document.querySelector<HTMLElement>(
          '[data-testid="pace-tooltip"]',
        );
        const activePoint = document.querySelector<HTMLElement>(
          ".pace-active-point",
        );
        if (tooltipElement === null || activePoint === null) {
          return null;
        }
        const tooltipBounds = tooltipElement.getBoundingClientRect();
        const pointBounds = activePoint.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          tooltip: {
            left: tooltipBounds.left,
            right: tooltipBounds.right,
            top: tooltipBounds.top,
            bottom: tooltipBounds.bottom,
          },
          pointCenter: {
            x: pointBounds.left + pointBounds.width / 2,
            y: pointBounds.top + pointBounds.height / 2,
          },
        };
      });
    await expect
      .poll(async () => {
        const current = await readTooltipGeometry();
        if (current === null) return false;
        const verticalGap = Math.min(
          Math.abs(current.tooltip.top - current.pointCenter.y),
          Math.abs(current.tooltip.bottom - current.pointCenter.y),
        );
        return (
          current.tooltip.left >= 0 &&
          current.tooltip.right <= current.viewportWidth &&
          current.tooltip.top >= 0 &&
          current.tooltip.bottom <= current.viewportHeight &&
          current.pointCenter.x >= current.tooltip.left &&
          current.pointCenter.x <= current.tooltip.right &&
          verticalGap <= 24
        );
      })
      .toBe(true);
    const geometry = await readTooltipGeometry();
    expect(geometry).not.toBeNull();
    if (geometry !== null) {
      expect(geometry.tooltip.left).toBeGreaterThanOrEqual(0);
      expect(geometry.tooltip.right).toBeLessThanOrEqual(
        geometry.viewportWidth,
      );
      expect(geometry.tooltip.top).toBeGreaterThanOrEqual(0);
      expect(geometry.tooltip.bottom).toBeLessThanOrEqual(
        geometry.viewportHeight,
      );
      expect(geometry.pointCenter.x).toBeGreaterThanOrEqual(
        geometry.tooltip.left,
      );
      expect(geometry.pointCenter.x).toBeLessThanOrEqual(
        geometry.tooltip.right,
      );
      expect(
        Math.min(
          Math.abs(geometry.tooltip.top - geometry.pointCenter.y),
          Math.abs(geometry.tooltip.bottom - geometry.pointCenter.y),
        ),
      ).toBeLessThanOrEqual(24);
    }
    const themeButton = page.getByRole("button", { name: /Theme:/ });
    const initialTheme = await themeButton.textContent();
    await themeButton.click();
    await expect(themeButton).not.toHaveText(initialTheme ?? "");
    await expect(scrubber).toHaveValue(value);
    await expect(scrubber).toHaveAttribute("aria-valuetext", selected ?? "");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("renders focus, errors, and graph encodings in forced colors", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Forced-colors emulation is verified in Chromium.",
    );
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Typing input" });
    await input.press("x");
    await expect(
      page.locator(".prompt-character.is-incorrect"),
    ).toHaveCount(1);
    await input.press("Escape");
    const words = await chooseTenWords(page);
    await input.pressSequentially(words.join(" "), { delay: 30 });
    await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
    await expect(page.locator("path.pace-line--wpm")).toHaveAttribute(
      "d",
      /\bC\b/,
    );
    await expect(page.locator("path.pace-line--raw")).toHaveAttribute(
      "d",
      /\bC\b/,
    );
    expect(
      await page
        .locator("path.pace-line--raw")
        .evaluate((element) => getComputedStyle(element).strokeDasharray),
    ).not.toBe("none");
    const paceScrubber = page.getByRole("slider", {
      name: "Inspect typing pace",
    });
    await expect(paceScrubber).toBeVisible();
    await paceScrubber.focus();
    await expect(paceScrubber).toBeFocused();
    await expect(page.locator(".pace-chart-shell")).toHaveClass(/is-focused/);
    await expect(page.locator(".pace-plot")).toHaveCSS(
      "outline-style",
      "solid",
    );
    await expect(page.locator(".pace-plot")).toHaveCSS(
      "outline-width",
      "2px",
    );
  });
});

test("keeps a signed-in pending result visible when sync is unavailable", async ({
  page,
}) => {
  const ownerId = "7f12cb7c-cf3a-43eb-a195-c611073c30c7";
  await page.addInitScript(
    ({ accountId }) => {
      localStorage.setItem(
        "typethock.pending-account-results.v2",
        JSON.stringify({
          version: 2,
          entries: [
            {
              ownerId: accountId,
              result: {
                clientResultId: "5bf586b8-d887-47bb-b512-97ca796451f7",
                mode: "words",
                modeValue: 10,
                punctuation: false,
                numbers: false,
                contentType: "words",
                language: "en",
                errorPolicy: "normal",
                durationMs: 10_000,
                typedCharacters: 50,
                correctAttempts: 48,
                incorrectAttempts: 2,
                correctCharacters: 45,
                incorrectCharacters: 4,
                missingCharacters: 1,
                extraAttempts: 1,
                correctedErrors: 1,
                wpm: 54,
                rawWpm: 60,
                accuracy: 96,
                consistency: 100,
                paceBuckets: [
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 5, rawCharacters: 5, errors: 1 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 10, rawCharacters: 10, errors: 1 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 15, rawCharacters: 15, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 20, rawCharacters: 20, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 25, rawCharacters: 25, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 30, rawCharacters: 30, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 35, rawCharacters: 35, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 40, rawCharacters: 40, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 45, rawCharacters: 45, errors: 0 },
                  { durationMs: 1_000, typedCharacters: 5, correctCharacters: 45, rawCharacters: 50, errors: 0 },
                ],
                completedAt: "2026-07-26T00:00:00Z",
                completionReason: "finished",
              },
            },
          ],
        }),
      );
    },
    { accountId: ownerId },
  );
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (pathname === "/api/auth/session") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: ownerId,
            username: "pending_reader",
            createdAt: "2026-07-26T00:00:00Z",
          },
          csrfToken: "csrf-pending",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        code: "SERVICE_UNAVAILABLE",
        detail: "The service is temporarily unavailable.",
      }),
    });
  });

  await page.goto("/history");
  await expect(page.getByText("sync pending", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Personal records" }),
  ).toBeVisible();
  await expect(page.getByText("Server history could not be loaded.")).toBeVisible();
});

test("account result, export, logout, and deletion lifecycle", async ({ page }) => {
  test.skip(
    process.env.E2E_ACCOUNT !== "true",
    "Requires the Compose backend and PostgreSQL.",
  );
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const username = `e2e_${suffix}`;
  const password = "quiet-river-password";

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "account", exact: true }).click();
  const accountDialog = page.getByRole("dialog");
  await expect(accountDialog).toHaveAccessibleName("Account");
  await accountDialog
    .getByRole("button", { name: "create account", exact: true })
    .first()
    .click();
  const registrationForm = accountDialog.locator("form");
  await registrationForm.getByLabel("username").fill(username);
  const registrationPassword = registrationForm.getByLabel("password");
  await expect(registrationPassword).toHaveAttribute("type", "password");
  await registrationForm.getByRole("button", { name: "show" }).click();
  await expect(registrationPassword).toHaveAttribute("type", "text");
  await expect(
    registrationForm.getByRole("button", { name: "hide" }),
  ).toHaveAttribute("aria-pressed", "true");
  await registrationPassword.fill(password);
  const registrationResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/register" &&
      response.request().method() === "POST",
  );
  await registrationForm
    .getByRole("button", { name: "create account", exact: true })
    .click();
  expect((await registrationResponse).status()).toBe(201);
  await expect(accountDialog).toHaveAccessibleName(username);
  await expect(accountDialog.getByRole("heading", { name: username })).toBeVisible();
  await accountDialog.getByRole("button", { name: /close/ }).click();

  const resultResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/results" &&
      response.request().method() === "POST",
  );
  await completeTenWords(page);
  expect((await resultResponse).status()).toBe(201);
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "history" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Personal records" }),
  ).toBeVisible();
  await expect(page.locator(".personal-records li")).toHaveCount(1);

  await page.getByRole("button", { name: username }).click();
  const signedInDialog = page.getByRole("dialog");
  await expect(signedInDialog).toHaveAccessibleName(username);
  const downloadPromise = page.waitForEvent("download");
  await signedInDialog.getByRole("button", { name: "export data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^typethock-export-\d{4}-\d{2}-\d{2}\.json$/);
  await signedInDialog.getByRole("button", { name: "sign out" }).click();
  await expect(page.getByRole("button", { name: "account", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "account", exact: true }).click();
  const loginDialog = page.getByRole("dialog");
  await expect(loginDialog).toHaveAccessibleName("Account");
  await expect(
    loginDialog.getByRole("button", { name: "sign in", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  const loginForm = loginDialog.locator("form");
  await expect(loginForm.getByLabel("username")).toHaveValue("");
  await expect(loginForm.getByLabel("password")).toHaveValue("");
  await loginForm.getByLabel("username").fill(username);
  await loginForm.getByLabel("password").fill(password);
  await loginForm.getByRole("button", { name: "sign in", exact: true }).click();
  await expect(loginDialog).toHaveAccessibleName(username);
  await expect(loginDialog.getByRole("heading", { name: username })).toBeVisible();
  await loginDialog.getByRole("button", { name: "delete account" }).click();
  const deletionForm = loginDialog.locator("form");
  await deletionForm.getByLabel("confirm password").fill(password);
  await deletionForm
    .getByRole("button", { name: "delete account", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "account", exact: true })).toBeVisible();
});

test("account password can be revealed and concealed without losing its value", async ({
  page,
}) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: false,
        user: null,
        csrfToken: "csrf-password-visibility",
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "account", exact: true }).click();
  const accountDialog = page.getByRole("dialog", { name: "Account" });
  const password = accountDialog.getByLabel("password");
  const toggle = accountDialog.getByRole("button", { name: "show" });

  await password.fill("quiet-river-password");
  await expect(password).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("quiet-river-password");
  await expect(
    accountDialog.getByRole("button", { name: "hide" }),
  ).toHaveAttribute("aria-pressed", "true");
  await accountDialog.getByRole("button", { name: "hide" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("quiet-river-password");

  await accountDialog.getByRole("button", { name: "show" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await accountDialog.getByRole("button", { name: /close/ }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
  const reopenedDialog = page.getByRole("dialog", { name: "Account" });
  const reopenedPassword = reopenedDialog.getByLabel("password");
  await expect(reopenedPassword).toHaveAttribute("type", "password");
  await expect(reopenedPassword).toHaveValue("");
  await expect(
    reopenedDialog.getByRole("button", { name: "show" }),
  ).toHaveAttribute("aria-pressed", "false");

  await reopenedDialog.getByRole("button", { name: "show" }).click();
  await expect(reopenedPassword).toHaveAttribute("type", "text");
  await reopenedDialog
    .getByRole("button", { name: "create account", exact: true })
    .click();
  const registrationPassword = reopenedDialog.getByLabel("password");
  await expect(registrationPassword).toHaveAttribute("type", "password");
  await expect(registrationPassword).toHaveValue("");
  await expect(
    reopenedDialog.getByRole("button", { name: "show" }),
  ).toHaveAttribute("aria-pressed", "false");
});

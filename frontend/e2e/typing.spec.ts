import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const runtimeErrors = new WeakMap<Page, string[]>();

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

async function chooseTenWords(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "words", exact: true }).click();
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

async function completeTenWords(page: Page): Promise<void> {
  const words = await chooseTenWords(page);
  await page.getByRole("textbox", { name: "Typing input" }).pressSequentially(
    words.join(" "),
    { delay: 1 },
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
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        apiRequests.push(new URL(request.url()).pathname);
      }
    });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "Typing input" })).toBeFocused();

    await completeTenWords(page);
    await expect(page.getByText("saved", { exact: true })).toBeVisible();
    expect(apiRequests).toEqual(["/api/auth/session"]);
    expect(apiRequests).not.toContain("/api/results");
    await page.getByRole("button", { name: "change test" }).focus();
    await page.getByRole("button", { name: "change test" }).press("Enter");
    await expect(
      page.getByRole("button", { name: "time", exact: true }),
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
      page.getByRole("button", { name: "words", exact: true }),
    ).toBeDisabled();
    await page.getByRole("textbox", { name: "Typing input" }).press("Escape");
    await expect(
      page.getByRole("button", { name: "words", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText(/Current word: .* Word 1 of 10\./)).toBeVisible();
  });

  test("restarts with Enter after inspecting the completed chart", async ({
    page,
  }) => {
    await page.goto("/");
    await completeTenWords(page);
    const scrubber = page.getByRole("slider", {
      name: "Inspect raw typing pace",
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
    await page.goto("/");
    for (const theme of ["paper", "nocturne", "tide"]) {
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Theme: ${theme}`),
        }),
      ).toBeVisible();
      const initial = await new AxeBuilder({ page }).analyze();
      expect(initial.violations).toEqual([]);
      await page.getByRole("button", { name: new RegExp(`Theme: ${theme}`) }).click();
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
    await page.getByRole("button", { name: /Theme: paper/ }).click();
    await expect(page.getByRole("button", { name: /Theme: nocturne/ })).toBeVisible();
  });

  test("keeps keyboard focus, repeated correction, and paste handling predictable", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "words", exact: true }).click();
    const prompt = page.getByRole("button", { name: "Focus typing input" });
    const input = page.getByRole("textbox", { name: "Typing input" });

    await prompt.focus();
    await prompt.press("Enter");
    await expect(input).toBeFocused();
    await input.pressSequentially("ab");
    await expect(
      page.locator(
        ".prompt-word.is-active .prompt-character.is-correct, .prompt-word.is-active .prompt-character.is-incorrect",
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
      page.locator(
        ".prompt-word.is-active .prompt-character.is-correct, .prompt-word.is-active .prompt-character.is-incorrect",
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
      .locator(".prompt-word.is-active .typing-caret")
      .boundingBox();
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
    const extras = page.locator(".prompt-word.is-active .prompt-extras");
    const extrasBox = await extras.boundingBox();
    const afterExtras = await nextWord.boundingBox();
    const caretWithExtras = await page
      .locator(".prompt-word.is-active .typing-caret")
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
      .locator(".prompt-word.is-active .typing-caret")
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
    await expect(activeWord).not.toHaveClass(/is-active/);
    await expect(nextWord).toHaveClass(/is-active/);

    await input.press("Backspace");
    await expect(activeWord).toHaveClass(/is-active/);
    await expect(nextWord).not.toHaveClass(/is-active/);
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
    await expect(restartedSecondWord).toHaveClass(/is-active/);
    await input.press("Backspace");
    await expect(restartedSecondWord).toHaveClass(/is-active/);
    await expect(restartedFirstWord).not.toHaveClass(/is-active/);
  });

  test("reveals pace samples with pointer and keyboard exploration", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "words", exact: true }).click();
    await page.getByRole("button", { name: "10", exact: true }).click();
    const targets = (await readPromptTargets(page)).slice(0, 10);
    await page
      .getByRole("textbox", { name: "Typing input" })
      .pressSequentially(targets.join(" "), { delay: 30 });
    await expect(page.getByRole("heading", { name: /^\d+$/ })).toBeVisible();
    await expect(page.locator("path.pace-line")).toHaveAttribute("d", /\bC\b/);

    const scrubber = page.getByRole("slider", {
      name: "Inspect raw typing pace",
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
    await expect(tooltip).toContainText("raw pace");
    await expect(tooltip).toContainText("typed");
    await expect(tooltip).toContainText("window");
    const firstSample = await tooltip.textContent();

    if (plotBox !== null) {
      await page.mouse.move(
        plotBox.x + plotBox.width * 0.9,
        plotBox.y + plotBox.height * 0.5,
      );
    }
    await expect(tooltip).not.toHaveText(firstSample ?? "");
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
      /raw words per minute.*typed characters?/,
    );
    await expect(tooltip).toBeVisible();
    await scrubber.press("Home");
    await expect(scrubber).toHaveValue("0");
  });

  test("keeps a tiny terminal window from becoming a 500-WPM sample", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "rill.guest-results.v1",
        JSON.stringify({
          version: 1,
          results: [
            {
              clientResultId: "pace-window-regression",
              mode: "words",
              modeValue: 10,
              punctuation: false,
              numbers: false,
              durationMs: 2_024,
              typedCharacters: 15,
              correctAttempts: 15,
              incorrectAttempts: 0,
              correctCharacters: 15,
              missingCharacters: 0,
              extraAttempts: 0,
              correctedErrors: 0,
              wpm: 88.93,
              rawWpm: 88.93,
              accuracy: 100,
              consistency: 0.7,
              paceBuckets: [
                { durationMs: 1_000, typedCharacters: 7 },
                { durationMs: 1_000, typedCharacters: 7 },
                { durationMs: 24, typedCharacters: 1 },
              ],
              completedAt: "2026-07-26T00:00:00Z",
              completionReason: "finished",
            },
          ],
        }),
      );
    });

    await page.goto("/history");
    await expect(page.getByText("avg 89 · peak 94")).toBeVisible();
    await expect(
      page.locator(".pace-y-tick").filter({ hasText: /^500$/ }),
    ).toHaveCount(0);
    await expect(page.getByText("94.5%")).toBeVisible();

    const scrubber = page.getByRole("slider", {
      name: "Inspect raw typing pace",
    });
    await expect(scrubber).toHaveAttribute("max", "1");
    await scrubber.focus();
    await scrubber.press("End");
    await expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "1 to 2.024 seconds, 94 raw words per minute, 8 typed characters",
    );
    await expect(page.getByTestId("pace-tooltip")).toContainText("1–2.024s");
    if (testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "output/playwright/pace-terminal-window-desktop.png",
        fullPage: true,
      });
    }
  });

  test("reveals a pace sample by touch", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Touch interaction is exercised by the touch-enabled project.",
    );

    await page.goto("/");
    await page.getByRole("button", { name: "words", exact: true }).click();
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
      name: "Inspect raw typing pace",
    });
    await expect(page.getByTestId("pace-tooltip")).toBeVisible();
    await expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      /raw words per minute.*typed characters?/,
    );
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
      localStorage.setItem("rill.theme.v1", "nocturne");
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
});

test("keeps a signed-in pending result visible when sync is unavailable", async ({
  page,
}) => {
  const ownerId = "7f12cb7c-cf3a-43eb-a195-c611073c30c7";
  await page.addInitScript(
    ({ accountId }) => {
      localStorage.setItem(
        "rill.pending-account-results.v1",
        JSON.stringify({
          version: 1,
          entries: [
            {
              ownerId: accountId,
              result: {
                clientResultId: "5bf586b8-d887-47bb-b512-97ca796451f7",
                mode: "words",
                modeValue: 10,
                punctuation: false,
                numbers: false,
                durationMs: 10_000,
                typedCharacters: 50,
                correctAttempts: 48,
                incorrectAttempts: 2,
                correctCharacters: 45,
                missingCharacters: 1,
                extraAttempts: 1,
                correctedErrors: 1,
                wpm: 54,
                rawWpm: 60,
                accuracy: 94.12,
                consistency: 90,
                paceBuckets: [
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
                  { durationMs: 1_000, typedCharacters: 5 },
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

  await page.goto("/");
  await page.getByRole("button", { name: "account", exact: true }).click();
  const accountDialog = page.getByRole("dialog");
  await expect(accountDialog).toHaveAccessibleName("Account");
  await accountDialog
    .getByRole("button", { name: "create account", exact: true })
    .first()
    .click();
  const registrationForm = accountDialog.locator("form");
  await registrationForm.getByLabel("username").fill(username);
  await registrationForm.getByLabel("password").fill(password);
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

  await completeTenWords(page);
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
  expect(download.suggestedFilename()).toMatch(/^rill-export-\d{4}-\d{2}-\d{2}\.json$/);
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

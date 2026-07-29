import { expect, test, type Locator, type Page } from "@playwright/test";

async function useCustomText(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "custom", exact: true }).click();
  await page.getByLabel("Your practice text").fill(text);
  await page.getByRole("button", { name: "use text" }).click();
}

async function dispatchComposition(
  input: Locator,
  type: "compositionstart" | "compositionupdate" | "compositionend",
  data: string,
): Promise<void> {
  await input.evaluate(
    (element, eventInit) => {
      element.dispatchEvent(
        new CompositionEvent(eventInit.type, {
          bubbles: true,
          cancelable: true,
          data: eventInit.data,
        }),
      );
    },
    { type, data },
  );
}

test.describe("typing behavior parity", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      return pathname.startsWith("/api/")
        ? route.abort("connectionrefused")
        : route.continue();
    });
    await page.goto("/");
  });

  test("leaves browser tab chords alone and routes plain Tab to restart", async ({
    page,
  }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });
    await expect(input).toBeFocused();

    await input.press("Space");
    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
    await expect(page.getByText("begin when ready", { exact: true })).toBeVisible();

    for (const shiftKey of [false, true]) {
      const outcome = await input.evaluate((element, shift) => {
        const event = new KeyboardEvent("keydown", {
          key: "Tab",
          code: "Tab",
          ctrlKey: true,
          shiftKey: shift,
          bubbles: true,
          cancelable: true,
        });
        return {
          dispatchReturned: element.dispatchEvent(event),
          defaultPrevented: event.defaultPrevented,
        };
      }, shiftKey);

      expect(outcome).toEqual({
        dispatchReturned: true,
        defaultPrevented: false,
      });
    }

    const plainTabOutcome = await input.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        bubbles: true,
        cancelable: true,
      });
      return {
        dispatchReturned: element.dispatchEvent(event),
        defaultPrevented: event.defaultPrevented,
      };
    });
    expect(plainTabOutcome).toEqual({
      dispatchReturned: false,
      defaultPrevented: true,
    });

    const restartButton = page.getByRole("button", {
      name: "Restart test",
      exact: true,
    });
    await expect(restartButton).toBeVisible();
    await expect(restartButton).toBeFocused();
    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
    await restartButton.press("Enter");
    await expect(input).toBeFocused();

    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
    await expect(page.getByText("begin when ready", { exact: true })).toBeVisible();

    await input.press("c");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);

    for (const shiftKey of [false, true]) {
      const outcome = await input.evaluate((element, shift) => {
        const event = new KeyboardEvent("keydown", {
          key: "Tab",
          code: "Tab",
          ctrlKey: true,
          shiftKey: shift,
          bubbles: true,
          cancelable: true,
        });
        return {
          dispatchReturned: element.dispatchEvent(event),
          defaultPrevented: event.defaultPrevented,
        };
      }, shiftKey);

      expect(outcome).toEqual({
        dispatchReturned: true,
        defaultPrevented: false,
      });
    }

    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
    await input.press("Tab");
    await expect(restartButton).toBeFocused();
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
    await input.focus();
    await input.press("a");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(2);
  });

  test("commits an unfinished word on Space and allows it to be corrected", async ({
    page,
  }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });
    const firstWord = page.locator('[data-prompt-index="0"]');
    const secondWord = page.locator('[data-prompt-index="1"]');

    await input.press("c");
    await input.press("Space");

    await expect(firstWord.locator(".prompt-character.is-correct")).toHaveText([
      "c",
    ]);
    await expect(firstWord.locator(".prompt-character.is-missing")).toHaveText([
      "a",
      "t",
    ]);
    await expect(secondWord.locator(".typing-caret")).toHaveCount(1);
    await expect(page.locator("#current-target")).toContainText(
      "Current word: dog. Word 2 of 2.",
    );
    await expect(input).toBeFocused();

    await input.press("Space");
    await expect(secondWord.locator(".typing-caret")).toHaveCount(1);
    await expect(firstWord.locator(".prompt-character.is-missing")).toHaveCount(
      2,
    );

    await input.press("Backspace");
    await expect(firstWord.locator(".typing-caret")).toHaveCount(1);
    await expect(firstWord.locator(".prompt-character.is-missing")).toHaveCount(
      0,
    );
    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );

    await input.pressSequentially("at", { delay: 20 });
    await input.press("Space");
    await input.pressSequentially("dog", { delay: 20 });

    await expect(page.getByText("accuracy", { exact: true })).toBeVisible();
    await expect(
      page.locator(".result-details").getByText("87.5%", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".result-details").getByText("7/0/0/0", { exact: true }),
    ).toBeVisible();
  });

  test("deletes whole words without crossing a perfect previous word", async ({
    page,
  }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });
    const firstWord = page.locator('[data-prompt-index="0"]');
    const secondWord = page.locator('[data-prompt-index="1"]');

    await input.pressSequentially("cxt");
    await input.press("Control+Backspace");
    await expect(firstWord.locator(".is-correct, .is-incorrect")).toHaveCount(0);

    await input.press("c");
    await input.press("Space");
    await input.press("Control+Backspace");
    await expect(firstWord.locator(".typing-caret")).toHaveCount(1);
    await expect(firstWord.locator(".is-correct, .is-incorrect")).toHaveCount(0);

    await input.pressSequentially("cat");
    await input.press("Space");
    await expect(secondWord.locator(".typing-caret")).toHaveCount(1);
    await input.press("Control+Backspace");
    await expect(secondWord.locator(".typing-caret")).toHaveCount(1);
    await expect(firstWord.locator(".is-correct")).toHaveCount(3);

    await input.pressSequentially("dog");
    await expect(page.getByText("accuracy", { exact: true })).toBeVisible();
    await expect(
      page.locator(".result-details").getByText("83.3%", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".result-details").getByText("7/0/0/0", { exact: true }),
    ).toBeVisible();
  });

  test("normalizes an IME-produced Unicode separator", async ({ page }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });

    await input.pressSequentially("cat");
    const prevented = await input.evaluate((element) => {
      const event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: "\u3000",
        inputType: "insertText",
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(prevented).toBe(true);
    await expect(
      page.locator('[data-prompt-index="1"] .typing-caret'),
    ).toHaveCount(1);
  });

  test("shows IME pre-edit text without moving the prompt", async ({ page }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });
    const activeWord = page.locator('[data-prompt-index="0"]');
    const followingWord = page.locator('[data-prompt-index="1"]');
    const promptWindow = page.locator(".prompt-window");
    const before = {
      active: await activeWord.boundingBox(),
      following: await followingWord.boundingBox(),
      scrollTop: await promptWindow.evaluate((element) => element.scrollTop),
    };

    await dispatchComposition(input, "compositionstart", "");
    await dispatchComposition(
      input,
      "compositionupdate",
      "\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059",
    );

    await expect(page.locator(".prompt-composition")).toHaveText(
      "\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059",
    );
    const after = {
      active: await activeWord.boundingBox(),
      following: await followingWord.boundingBox(),
      scrollTop: await promptWindow.evaluate((element) => element.scrollTop),
    };
    expect(after.active).toEqual(before.active);
    expect(after.following).toEqual(before.following);
    expect(after.scrollTop).toBe(before.scrollTop);

    await dispatchComposition(input, "compositionend", "");
  });

  test("refocuses after page-chrome focus without scoring the recovery key", async ({
    page,
  }) => {
    await useCustomText(page, "cat dog");
    const input = page.getByRole("textbox", { name: "Typing input" });
    const themeButton = page.locator('header button[aria-label^="Theme:"]');
    await themeButton.click();
    await themeButton.focus();
    await expect(themeButton).toBeFocused();

    await page.keyboard.press("x");
    await expect(input).toBeFocused();
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
    await expect(page.locator(".prompt-character.is-incorrect")).toHaveCount(0);

    await page.keyboard.press("c");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
  });

  test("commits one IME result and no canceled composition", async ({ page }) => {
    await useCustomText(page, "\u3042 dog");
    const input = page.getByRole("textbox", { name: "Typing input" });

    await dispatchComposition(input, "compositionstart", "");
    await dispatchComposition(input, "compositionupdate", "\u3042");
    await dispatchComposition(input, "compositionend", "\u3042");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);

    await dispatchComposition(input, "compositionstart", "");
    await dispatchComposition(input, "compositionupdate", "\u3044");
    await dispatchComposition(input, "compositionend", "");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
    await expect(page.locator(".prompt-character.is-incorrect")).toHaveCount(0);
  });

  test("restarts predictably with Escape and completed-state Enter", async ({
    page,
  }) => {
    await useCustomText(page, "cat dog");
    let input = page.getByRole("textbox", { name: "Typing input" });

    await input.press("c");
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(1);
    await input.press("Escape");

    input = page.getByRole("textbox", { name: "Typing input" });
    await expect(input).toBeFocused();
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
    await expect(page.getByText("begin when ready", { exact: true })).toBeVisible();
    await expect(page.locator("#current-target")).toContainText(
      "Current word: cat. Word 1 of 2.",
    );

    await input.pressSequentially("cat");
    await input.press("Space");
    await input.pressSequentially("dog");
    await expect(page.getByText("accuracy", { exact: true })).toBeVisible();
    await input.press("Tab");
    const againButton = page.getByRole("button", {
      name: "again enter",
      exact: true,
    });
    await expect(againButton).toBeFocused();
    await againButton.press("Enter");

    input = page.getByRole("textbox", { name: "Typing input" });
    await expect(input).toBeFocused();
    await expect(page.getByText("begin when ready", { exact: true })).toBeVisible();
    await expect(page.locator(".prompt-character.is-correct")).toHaveCount(0);
  });
});

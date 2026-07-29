import { chromium } from "@playwright/test";

const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:8080";
const delayMs = Number(process.env.PERF_KEY_DELAY_MS ?? 25);
const mode = process.env.PERF_MODE === "code" ? "code" : "words";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const networkRequests = [];
const consoleErrors = [];
const pageErrors = [];

page.on("request", (request) => {
  networkRequests.push({
    method: request.method(),
    resourceType: request.resourceType(),
    url: request.url(),
  });
});
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  pageErrors.push(error.message);
});

await page.addInitScript(() => {
  window.__rillPerformanceAudit = {
    beforeInputFrames: [],
    cspViolations: [],
    eventTimings: [],
    layoutShifts: [],
    longTasks: [],
  };
  document.addEventListener(
    "beforeinput",
    (event) => {
      const start = performance.now();
      requestAnimationFrame((frameTime) => {
        window.__rillPerformanceAudit.beforeInputFrames.push({
          inputType: event.inputType,
          duration: frameTime - start,
        });
      });
    },
    { capture: true },
  );
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__rillPerformanceAudit.cspViolations.push({
      blockedURI: event.blockedURI,
      effectiveDirective: event.effectiveDirective,
      violatedDirective: event.violatedDirective,
    });
  });

  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__rillPerformanceAudit.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    }).observe({ type: "longtask", buffered: true });
  }
  if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__rillPerformanceAudit.layoutShifts.push({
          startTime: entry.startTime,
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  }
  if (PerformanceObserver.supportedEntryTypes.includes("event")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__rillPerformanceAudit.eventTimings.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          interactionId: entry.interactionId,
          inputDelay: entry.processingStart - entry.startTime,
          processingDuration: entry.processingEnd - entry.processingStart,
          presentationDelay: entry.duration - (entry.processingEnd - entry.startTime),
        });
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  if (mode === "code") {
    await page
      .getByRole("group", { name: "Text source" })
      .getByRole("button", { name: "code", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Code language" })
      .selectOption("python3");
  } else {
    await page
      .getByRole("group", { name: "Test limit" })
      .getByRole("button", { name: "words", exact: true })
      .click();
    await page.getByRole("button", { name: "10", exact: true }).click();
  }

  const targets = await page.locator(".prompt-word").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-prompt-target") ?? ""),
  );
  const prompt = targets.join(mode === "code" ? "\n" : " ");
  const cssDataFonts = await page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const css = await Promise.all(
      links.map(async (link) => await (await fetch(link.href)).text()),
    );
    return css.filter((text) => text.includes("data:font")).length;
  });
  const input = page.getByRole("textbox", { name: "Typing input" });
  const requestBaseline = networkRequests.length;
  const typingStart = await page.evaluate(() => performance.now());
  const wallStart = performance.now();
  if (mode === "code") {
    for (let index = 0; index < targets.length; index += 1) {
      await input.pressSequentially(targets[index] ?? "", { delay: delayMs });
      if (index < targets.length - 1) {
        await input.press("Enter");
      }
    }
  } else {
    await input.pressSequentially(prompt, { delay: delayMs });
  }
  const typingEnd = await page.evaluate(() => performance.now());
  await page.getByRole("heading", { name: /^\d+$/ }).waitFor();
  const wallDurationMs = performance.now() - wallStart;
  await page.waitForTimeout(250);

  const evidence = await page.evaluate(
    ({
      requestBaseline,
      typingStart,
      typingEnd,
      wallDurationMs,
      delayMs,
      mode,
      prompt,
    }) => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const audit = window.__rillPerformanceAudit;
      const afterTyping = (entry) => entry.startTime >= typingStart;
      const duringTyping = (entry) =>
        entry.startTime >= typingStart && entry.startTime <= typingEnd;
      const eventDurations = audit.eventTimings
        .filter(duringTyping)
        .map((entry) => entry.duration);
      const inputFrameDurations = audit.beforeInputFrames.map(
        (entry) => entry.duration,
      );
      const percentile = (values, ratio) => {
        if (values.length === 0) return null;
        const ordered = [...values].sort((left, right) => left - right);
        return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)];
      };
      const result = document.querySelector(".results");

      return {
        run: {
          baseUrl: location.origin,
          delayMs,
          mode,
          prompt,
          promptCharacters: prompt.length,
          typingStart,
          typingEnd,
          wallDurationMs,
          requestBaseline,
        },
        navigation: navigation
          ? {
              duration: navigation.duration,
              domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
              loadEventEnd: navigation.loadEventEnd,
              responseStart: navigation.responseStart,
              transferSize: navigation.transferSize,
              decodedBodySize: navigation.decodedBodySize,
            }
          : null,
        resources: {
          count: resources.length,
          transferBytes: resources.reduce(
            (total, entry) => total + (entry.transferSize || 0),
            0,
          ),
          decodedBytes: resources.reduce(
            (total, entry) => total + (entry.decodedBodySize || 0),
            0,
          ),
        },
        typingWindow: {
          longTasks: audit.longTasks.filter(duringTyping),
          postTypingLongTasks: audit.longTasks.filter(
            (entry) => afterTyping(entry) && entry.startTime > typingEnd,
          ),
          layoutShifts: audit.layoutShifts.filter(afterTyping),
          layoutShiftsWithoutRecentInput: audit.layoutShifts.filter(
            (entry) => afterTyping(entry) && !entry.hadRecentInput,
          ),
          measuredEventCount: eventDurations.length,
          beforeInputFrameCount: inputFrameDurations.length,
          beforeInputFrameP50Ms: percentile(inputFrameDurations, 0.5),
          beforeInputFrameP95Ms: percentile(inputFrameDurations, 0.95),
          beforeInputFrameMaximumMs:
            inputFrameDurations.length === 0
              ? null
              : Math.max(...inputFrameDurations),
          maximumEventDurationMs:
            eventDurations.length === 0 ? null : Math.max(...eventDurations),
        },
        security: {
          cspViolations: audit.cspViolations,
        },
        viewport: {
          width: innerWidth,
          height: innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > innerWidth,
        },
        result: result
          ? {
              wpm: result.querySelector("#results-title")?.textContent,
              saveState: result.querySelector(".save-state")?.textContent,
            }
          : null,
      };
    },
    {
      requestBaseline,
      typingStart,
      typingEnd,
      wallDurationMs,
      delayMs,
      mode,
      prompt,
    },
  );

  evidence.browserVersion = browser.version();
  evidence.typingWindow.networkRequests =
    networkRequests.slice(requestBaseline);
  evidence.security.cssDataFontStylesheets = cssDataFonts;
  evidence.consoleErrors = consoleErrors;
  evidence.pageErrors = pageErrors;
  evidence.assertions = {
    completed: evidence.result !== null,
    noKeystrokeNetworkRequests:
      evidence.typingWindow.networkRequests.length === 0,
    noCspViolations: evidence.security.cspViolations.length === 0,
    noDataFontsInProductionCss:
      evidence.security.cssDataFontStylesheets === 0,
    inputToFrameUnder100Ms:
      evidence.typingWindow.beforeInputFrameMaximumMs !== null &&
      evidence.typingWindow.beforeInputFrameMaximumMs < 100,
    noUnexpectedHorizontalOverflow: !evidence.viewport.hasHorizontalOverflow,
    noRuntimeErrors: consoleErrors.length === 0 && pageErrors.length === 0,
  };
  evidence.diagnostics = {
    noLongTasksDuringTyping: evidence.typingWindow.longTasks.length === 0,
  };

  console.log(JSON.stringify(evidence, null, 2));
  if (Object.values(evidence.assertions).some((value) => !value)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

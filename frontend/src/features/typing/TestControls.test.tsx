import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestControls } from "./TestControls";
import type { TestConfig } from "./types";

afterEach(cleanup);

const config: TestConfig = {
  mode: "words",
  modeValue: 25,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

describe("TestControls", () => {
  it("exposes semantic configuration groups and toggles strict mode", () => {
    const onChange = vi.fn();
    render(
      <TestControls config={config} disabled={false} onChange={onChange} />,
    );

    const textSource = screen.getByRole("group", { name: "Text source" });
    const testLimit = screen.getByRole("group", { name: "Test limit" });
    expect(textSource).toBeVisible();
    expect(
      within(textSource).getByRole("button", { name: "words" }),
    ).toBeVisible();
    expect(
      within(testLimit).getByRole("button", { name: "words" }),
    ).toBeVisible();
    expect(screen.getByRole("group", { name: "Language" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "strict" }));

    expect(onChange).toHaveBeenCalledWith({
      ...config,
      errorPolicy: "strict",
    });
  });

  it("validates, normalizes, and applies tab-local custom text", () => {
    const onChange = vi.fn();
    render(
      <TestControls config={config} disabled={false} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "custom" }));
    expect(
      screen.getByText("It stays in this tab and is never uploaded.", {
        exact: false,
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "use text" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter at least two words.",
    );

    fireEvent.change(screen.getByLabelText("Your practice text"), {
      target: { value: "  cafe\u0301\n listo  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "use text" }));

    expect(onChange).toHaveBeenCalledWith(
      {
        ...config,
        contentType: "custom",
        mode: "words",
        modeValue: 2,
        punctuation: false,
        numbers: false,
      },
      "café listo",
    );
    expect(screen.queryByLabelText("Your practice text")).not.toBeInTheDocument();
  });

  it("offers the code corpus and switches its programming language", () => {
    const onChange = vi.fn();
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 8,
      contentType: "code",
      language: "en",
      codeLanguage: "python3",
    };
    render(
      <TestControls
        config={codeConfig}
        disabled={false}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("16 patterns · 512 drills")).toBeVisible();
    const language = screen.getByRole("combobox", {
      name: "Code language",
    });
    expect(language).toHaveValue("python3");
    fireEvent.change(language, { target: { value: "go" } });
    expect(onChange).toHaveBeenCalledWith({
      ...codeConfig,
      codeLanguage: "go",
    });
  });

  it("disables every configuration control while a test is running", () => {
    render(
      <TestControls config={config} disabled onChange={vi.fn()} />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    for (const select of screen.queryAllByRole("combobox")) {
      expect(select).toBeDisabled();
    }
  });
});

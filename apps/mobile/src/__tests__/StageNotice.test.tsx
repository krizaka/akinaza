import { ThemeProvider } from "@krizaka/ui/native";
import { cleanup, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { I18nProvider } from "@/i18n";
import { appStage } from "@/stage";
import { StageNotice } from "@/ui/StageNotice";

const show = async (stage: string, locale: "fr" | "en" = "fr") =>
  await render(
    <ThemeProvider>
      <I18nProvider locale={locale}>
        <StageNotice stage={stage} />
      </I18nProvider>
    </ThemeProvider>,
  );

afterEach(cleanup);

describe("the development-version notice (akinaza#368)", () => {
  it("shows on the dev stage, in the language of the app", async () => {
    await show("dev");
    expect(screen.getByText("Version de développement")).toBeTruthy();
    await cleanup();
    await show("dev", "en");
    expect(screen.getByText("Development version")).toBeTruthy();
  });

  it("renders nothing on production", async () => {
    await show("prod");
    expect(screen.queryByText("Version de développement")).toBeNull();
    await cleanup();
    await show("production");
    expect(screen.queryByText("Version de développement")).toBeNull();
  });

  it("reads the stage once from the build, and a build without one is a dev build", async () => {
    expect(appStage({ EXPO_PUBLIC_APP_ENV: "prod" })).toBe("prod");
    expect(appStage({})).toBe("dev");
  });
});

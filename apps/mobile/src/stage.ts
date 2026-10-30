/** The deployment's stage, read once from the build (the variable that also picks the manifest entry). No value is a development build: the notice then shows. */
export const appStage = (build: Readonly<Record<string, string | undefined>> = process.env): string => build.EXPO_PUBLIC_APP_ENV || "dev";

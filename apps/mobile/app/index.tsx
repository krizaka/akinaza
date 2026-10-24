import { Redirect } from "expo-router";

import { routes } from "@/domain/links";
import { currentLocale } from "@/i18n";

/** The app opens on the owner's day: the thing the owner came for. */
export default function Index() {
  return <Redirect href={routes.today(currentLocale()) as never} />;
}

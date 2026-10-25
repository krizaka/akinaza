import { Redirect } from "expo-router";

import { routes } from "@/domain/links";
import { currentLocale } from "@/i18n";

/** The app opens on the shop's day (`/fr/app` sends to the shop's own Aujourd'hui): the thing the owner came for. */
export default function Index() {
  return <Redirect href={routes.home(currentLocale()) as never} />;
}

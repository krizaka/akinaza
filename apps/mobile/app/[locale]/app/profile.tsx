import { useQuery } from "@krizaka/query";
import { Button, Card, Header, Screen, Segmented, Txt } from "@krizaka/ui/native";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { useAuth } from "@/auth";
import { APP_VERSION, queries } from "@/config";
import { LOCALES } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

/** Profil (`/fr/app/profile`, the account's, as the web's): the language (the URL's), the account, the shop, signing out — under the avatar of every header (D8). */
export default function Profile() {
  const { t } = useI18n();
  const { locale, setLocale } = useLocale();
  const { signOut } = useAuth();
  const router = useRouter();
  const shop = useQuery(queries.shop());
  const me = useQuery(queries.me());
  return (
    <Screen header={<Header title={t("profile.title")} backLabel={t("common.back")} onBack={() => router.back()} size="inline" />}>
      <View style={{ gap: 8 }}>
        <Txt variant="label">{t("settings.language")}</Txt>
        <Segmented aria-label={t("settings.language")} options={LOCALES.map((value) => ({ value, label: t(`settings.languages.${value}`) }))} value={locale} onValueChange={setLocale} />
      </View>
      {me.data ? (
        <Card.Root>
          <Card.Body>
            <Txt variant="label">{t("settings.account")}</Txt>
            {me.data.name ? <Txt>{me.data.name}</Txt> : null}
            <Txt tone="secondary">{me.data.email}</Txt>
          </Card.Body>
        </Card.Root>
      ) : null}
      {shop.data ? (
        <Card.Root>
          <Card.Body>
            <Txt variant="label">{t("settings.shop")}</Txt>
            <Txt>{shop.data.shop.name}</Txt>
          </Card.Body>
        </Card.Root>
      ) : null}
      <Button variant="secondary" label={t("settings.signOut")} onPress={() => void signOut().then(() => router.replace("/sign-in"))} />
      <Txt tone="muted" variant="caption">{t("settings.version", { version: APP_VERSION })}</Txt>
    </Screen>
  );
}

import { useQuery } from "@krizaka/query";
import { Button, Card, EmptyState, Screen, Txt } from "@krizaka/ui/native";
import * as Linking from "expo-linking";
import * as React from "react";

import { queries, webUrl } from "@/config";
import { routes } from "@/domain/links";
import { dollars } from "@/domain/money";
import { useI18n } from "@/i18n";
import { AppHeader } from "@/ui/AppHeader";
import { QueryStates } from "@/ui/QueryStates";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

/**
 * Boutique (`/fr/app/<shop>/boutique`): what the phone needs of the shop — its name, its tax status, its terms and the services an
 * invoice can name. The page, the team and the hours are edited on the web's Boutique (one link): a form that long is a desk's.
 */
export default function Boutique() {
  const { t } = useI18n();
  const { locale } = useLocale();
  const shop = useShop();
  const setup = useQuery(queries.shop(shop));
  return (
    <Screen header={<AppHeader title={t("boutique.title")} />}>
      <QueryStates query={setup}>
        {(s) => (
          <>
            <Card.Root>
              <Card.Body>
                <Txt variant="label">{s.shop.name}</Txt>
                <Txt tone="secondary">{s.shop.registrant ? t("boutique.registrant") : t("boutique.smallSupplier")}</Txt>
                <Txt tone="secondary">{t("boutique.terms", { days: s.shop.paymentTermsDays })}</Txt>
              </Card.Body>
            </Card.Root>
            <Txt variant="label">{t("boutique.services")}</Txt>
            {s.services.length === 0 ? <EmptyState title={t("boutique.noServices")} /> : null}
            {s.services.map((service) => (
              <Card.Root key={service.id}>
                <Card.Body>
                  <Txt>{{ fr: service.nameFr, en: service.nameEn }[locale]}</Txt>
                  <Txt tone="secondary">{dollars(service.priceCents, locale)}</Txt>
                </Card.Body>
              </Card.Root>
            ))}
            <Button variant="secondary" label={t("boutique.edit")} onPress={() => void Linking.openURL(webUrl(routes.boutique(locale, shop)))} />
          </>
        )}
      </QueryStates>
    </Screen>
  );
}

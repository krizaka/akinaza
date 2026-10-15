import { invoiceTotals } from "@akinaza/core";
import { Mascot, ProductMark, Screen, Txt } from "@krizaka/ui/native";

/** The first screen: the mark, the beaver and the promise — the same tax code as the web, from @akinaza/core. */
export default function Home() {
  const example = invoiceTotals([{ description: "Coupe", quantity: 1, unitPriceCents: 4_500, category: "standard" }], { registrant: true });
  return (
    <Screen>
      <ProductMark id="akinaza" size={96} title="Akinaza" />
      <Mascot bird="beaver" mood="welcome" size={88} />
      <Txt variant="title">Akinaza</Txt>
      <Txt tone="secondary">Your shop, for less — Loi 25 by design. Sign-up is closed while Akinaza is in development.</Txt>
      <Txt tone="muted">A $45.00 haircut: GST {example.gstCents / 100} · QST {example.qstCents / 100} · total {example.totalCents / 100}.</Txt>
    </Screen>
  );
}

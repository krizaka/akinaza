/**
 * « Add a shop » runs in two requests: the shop, then its page and template. When the second fails the owner stays on the form, and a
 * retry must configure the shop already made — never create another with the same slug. `state` remembers the id across attempts.
 */
export async function setUpNewShop(
  state: { shopId: string | null },
  create: () => Promise<string>,
  configure: (shopId: string) => Promise<void>,
): Promise<string> {
  state.shopId ??= await create();
  await configure(state.shopId);
  return state.shopId;
}

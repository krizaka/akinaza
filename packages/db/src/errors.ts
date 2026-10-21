/** A refusal of the shop operations: a stable `AK_…` code the API maps to a status and the client translates. */
export class ShopError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ShopError";
  }
}

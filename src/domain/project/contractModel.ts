/**
 * Which contract model of the library a quote is signed under: the one its project chose if it
 * still exists, otherwise the default one; null when there is neither. The library lives in the
 * settings, so here a model is anything with an id.
 */
export function chooseContractModel<T extends { readonly id: string }>(
  models: readonly T[],
  defaultId: string | null,
  chosenId: string | null
): T | null {
  const byId = (id: string | null) => (id === null ? undefined : models.find((model) => model.id === id))
  return byId(chosenId) ?? byId(defaultId) ?? null
}

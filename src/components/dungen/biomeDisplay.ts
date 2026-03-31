export const resolveDisplayedBiomeName = ({
  biomeId,
  contentBiomeName,
  biomeNamesById,
}: {
  biomeId: string | null;
  contentBiomeName: string | null;
  biomeNamesById: Map<string, string>;
}) => {
  if (biomeId) {
    return biomeNamesById.get(biomeId) ?? biomeId;
  }

  return contentBiomeName ?? 'unknown';
};

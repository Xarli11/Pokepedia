// Normalization shared by the search index builder and the search itself:
// case, accents, hyphens/punctuation and repeated spaces never matter.
//   "Piel Tosca" / "piel-tosca" / "PIEL  TOSCA"  ->  "piel tosca"
//   "Pokémon" -> "pokemon" · "Farfetch’d" -> "farfetchd" · "Mr. Mime" -> "mr mime"
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`´.]/g, '')
    .replace(/[^a-z0-9#♀♂]+/g, ' ')
    .replace(/♀/g, ' f')
    .replace(/♂/g, ' m')
    .replace(/\s+/g, ' ')
    .trim();
}

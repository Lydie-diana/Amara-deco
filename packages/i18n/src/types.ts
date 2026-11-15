import type { fr } from './fr';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Toutes les langues doivent avoir exactement les mêmes clés que le français. */
export type Resources = Widen<typeof fr>;
export type Namespace = keyof Resources;

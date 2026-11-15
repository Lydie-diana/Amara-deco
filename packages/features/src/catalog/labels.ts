import type { CategoryRow } from '@amara/api';
import { useCategories } from '@amara/api';
import { useTranslation } from '@amara/i18n';

/** Nom d'une catégorie dans la langue affichée. */
export function useCategoryName() {
  const { i18n } = useTranslation();
  const { data } = useCategories();
  return (id: string) => {
    const c: CategoryRow | undefined = data?.find((x) => x.id === id);
    if (!c) return id;
    return i18n.language === 'en' ? c.name_en : c.name_fr;
  };
}

/** Teintes des visuels en arche, choisies de façon stable à partir d'un identifiant. */
const ARCH_TINTS = ['#C9B79C', '#8E9A78', '#D8B98A', '#B9A48C', '#A7AE92', '#E0CDB4'] as const;

export function archTint(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ARCH_TINTS[h % ARCH_TINTS.length] ?? ARCH_TINTS[0];
}

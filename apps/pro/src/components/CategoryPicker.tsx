import { useCategories } from '@amara/api';
import { Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';

export function CategoryPicker({
  kind,
  value,
  onChange,
}: {
  kind: 'product' | 'service';
  value: string;
  onChange: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const { data = [] } = useCategories();
  const items = data
    .filter((c) => c.kind === kind)
    .map((c) => ({ key: c.id, label: i18n.language === 'en' ? c.name_en : c.name_fr }));
  return <Tabs value={value} onChange={onChange} items={items} />;
}

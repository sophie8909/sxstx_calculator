const CATEGORY_ALIASES = {
  daily: ['日用品'],
  flower: ['花'],
  book: ['書', '书'],
  valuables: ['貴重品', '贵重品'],
};

export function parseGiftSheet(csvRows, seasons) {
  const [headerRow = [], ...dataRows] = csvRows;
  const headers = headerRow.map((value) => String(value ?? '').trim());
  const findColumn = (...names) => headers.findIndex((header) => names.includes(header));
  const columns = {
    level: findColumn('level'),
    partner_required_favor: findColumn('夥伴所需好感', '伙伴所需好感', '所需好感'),
    star_god_required_favor: findColumn('星間之神所需好感', '星间之神所需好感'),
    quality: findColumn('禮物品質', '礼物品质'),
    favor: findColumn('好感'),
    price: findColumn('價格', '价格'),
  };
  const kingdomsByName = new Map();
  const addKingdom = (id, name) => {
    if (name && !kingdomsByName.has(name)) kingdomsByName.set(name, { id, name, aliases: [name] });
  };
  seasons.forEach((season) => addKingdom(season.id, String(season.kingdomName ?? '').trim()));
  // The gift sheet also lists countries outside the season catalog, after the price column.
  if (columns.price >= 0) {
    headers.forEach((name, index) => {
      if (index > columns.price && !Object.values(columns).includes(index)) {
        addKingdom('sheet-' + encodeURIComponent(name), name);
      }
    });
  }
  const kingdomColumns = headers.flatMap((name, index) => kingdomsByName.has(name) ? [{ name, index }] : []);
  const rows = dataRows.map((row) => {
    const result = Object.fromEntries(Object.entries(columns).map(([key, index]) => [key, String(row[index] ?? '').trim()]));
    const categories = Object.fromEntries(Object.keys(CATEGORY_ALIASES).map((category) => [category, new Set()]));
    kingdomColumns.forEach(({ name, index }) => {
      const values = String(row[index] ?? '').split(/[、,，;；\s]+/).filter(Boolean);
      Object.entries(CATEGORY_ALIASES).forEach(([category, aliases]) => {
        if (aliases.some((alias) => values.includes(alias))) categories[category].add(name);
      });
    });
    result.categories = Object.fromEntries(Object.entries(categories).map(([category, names]) => [category, [...names].join('、')]));
    return result;
  });
  return { rows, kingdoms: [...kingdomsByName.values()] };
}

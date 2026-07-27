export const SPREADSHEET_ID = '1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E';

export const SHEETS = Object.freeze({
  catalog: {
    title: '數據說明',
    gid: 1896125804,
    requiredHeaders: [],
    key: [],
  },
  serverSubmissions: {
    title: '伺服器時間',
    gid: 859085671,
    requiredHeaders: ['時間戳記', 'server_name', '伺服器編號'],
    aliases: { timestamp: ['時間戳記'], server_id: ['伺服器編號'] },
    key: [],
    appendOnly: true,
  },
  servers: {
    title: '伺服器',
    gid: 1981289603,
    requiredHeaders: [
      '伺服器編號',
      '伺服器名稱',
      'server_short',
      'realm_id',
      'merge_2',
      'merge_4',
      'merge_8',
      'merge_16',
      'current_state',
    ],
    aliases: {
      server_id: ['伺服器編號', 'server_id'],
      server_name: ['伺服器名稱', 'server_name'],
    },
    key: ['server_id'],
  },
  seasonScore: {
    title: '賽季分數',
    gid: 1012321192,
    requiredHeaders: ['season'],
    key: ['season'],
  },
  dungeons: {
    title: '副本',
    gid: 2044399102,
    requiredHeaders: ['賽季', '副本'],
    aliases: { season: ['賽季', 'season'], dungeon: ['副本', 'dungeon'] },
    key: ['season', 'dungeon'],
  },
  primordialRecommendations: {
    title: '原初檔位推薦',
    gid: 1955218134,
    requiredHeaders: ['season'],
    key: ['season', 'type'],
  },
  relics: {
    title: '遺物',
    gid: 2041024019,
    requiredHeaders: ['season'],
    key: ['season', 'profession', 'relic'],
  },
  characterUpgradeCosts: {
    title: '角色等級',
    gid: 314585849,
    requiredHeaders: ['level', 'cost_exp', 'season'],
    key: ['season', 'level'],
  },
  equipmentUpgradeCosts: {
    title: '裝備',
    gid: 1205841685,
    requiredHeaders: ['level', 'cost_stone_ore', 'cost_rola', 'season'],
    key: ['season', 'level'],
  },
  skillUpgradeCosts: {
    title: '技能',
    gid: 682954597,
    requiredHeaders: ['level', 'cost_essence', 'season'],
    key: ['season', 'level'],
  },
  relicUpgradeCosts: {
    title: '遺物等級',
    gid: 1548103854,
    requiredHeaders: ['level', 'cost_sand', 'season'],
    key: ['season', 'level'],
  },
  petUpgradeCosts: {
    title: '寵物',
    gid: 1910677696,
    requiredHeaders: ['level', 'cost_exp', 'cost_freeze_dried', 'season'],
    key: ['season', 'level'],
  },
  gifts: {
    title: '禮物',
    gid: 547650001,
    requiredHeaders: [],
    key: ['level'],
  },
  resources: {
    title: '資源',
    gid: 751788076,
    requiredHeaders: ['resource', 'season', 'type'],
    key: ['season', 'type', 'resource'],
  },
  rallyRules: {
    title: '世界集會規則',
    gid: 1438213065,
    requiredHeaders: ['season', 'enabled', 'world_count', 'group_size', 'strategy'],
    key: ['season'],
  },
  gameSettings: {
    title: '遊戲設定',
    gid: 107367349,
    requiredHeaders: ['key', 'value', 'type'],
    key: ['key', 'season'],
  },
});

export function getSheetDefinition(sheetKey) {
  const definition = SHEETS[sheetKey];
  if (!definition) throw new RangeError(`Unknown Google Sheet registry key: ${sheetKey}`);
  return definition;
}

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT_DIR, 'data', 'raw');
const GENERATED_DIR = path.join(ROOT_DIR, 'data', 'generated');
const OUTPUT_FILE = path.join(GENERATED_DIR, 'upgrade-costs.json');

const UPGRADE_FILES = {
  'character_upgrade_costs.csv': {
    category: 'character',
    tableKey: 'characterUpgradeCosts',
    fallbackHeaders: ['level', 'cost_exp', 'season'],
  },
  'equipment_upgrade_costs.csv': {
    category: 'equipment',
    tableKey: 'equipmentUpgradeCosts',
  },
  'skill_upgrade_costs.csv': {
    category: 'skill',
    tableKey: 'skillUpgradeCosts',
  },
  'relic_upgrade_costs.csv': {
    category: 'relic',
    tableKey: 'relicUpgradeCosts',
  },
  'pet_upgrade_costs.csv': {
    category: 'pet',
    tableKey: 'petUpgradeCosts',
  },
};

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function toTableName(fileName) {
  return path.basename(fileName, '.csv').replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function parseCsvRows(text, fileName) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushRow = () => {
    if (row.some((value) => String(value).trim() !== '')) {
      rows.push({ line: rowStartLine, cells: row });
    }
    row = [];
    cell = '';
    rowStartLine = line + 1;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(cell);
      if (char === '\r' && next === '\n') i += 1;
      pushRow();
      line += 1;
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error(`${fileName}: unterminated quoted cell near line ${line}`);
  }

  row.push(cell);
  pushRow();
  return rows;
}

function isHeaderRow(cells) {
  const headers = cells.map(normalizeHeader);
  return headers.includes('level') && headers.includes('season') && headers.some((header) => header.startsWith('cost_'));
}

function parseNumberCell(raw, fileName, line, header) {
  const value = String(raw ?? '').trim();
  if (value === '') return 0;

  const normalized = value.replace(/,/g, '');
  if (!/^[+-]?(?:\d+|\d*\.\d+)$/.test(normalized)) return value;

  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error(`${fileName}:${line}: invalid numeric value for ${header}: ${value}`);
  }
  if (Number.isInteger(number) && !Number.isSafeInteger(number)) {
    throw new Error(`${fileName}:${line}: unsafe integer value for ${header}: ${value}`);
  }
  return number;
}

function rowToObject(row, headers, fileName, parseNumbers) {
  if (row.cells.length > headers.length) {
    throw new Error(`${fileName}:${row.line}: expected ${headers.length} columns, found ${row.cells.length}`);
  }

  const object = {};
  headers.forEach((header, index) => {
    const raw = row.cells[index] ?? '';
    object[header] = parseNumbers
      ? parseNumberCell(raw, fileName, row.line, header)
      : String(raw ?? '').trim();
  });
  return object;
}

function parseUpgradeFile(fileName, parsedRows, config) {
  const headerIndex = parsedRows.findIndex((row) => isHeaderRow(row.cells));
  const hasHeader = headerIndex >= 0;
  const headers = hasHeader
    ? parsedRows[headerIndex].cells.map(normalizeHeader)
    : config.fallbackHeaders;

  if (!headers || headers.length === 0) {
    throw new Error(`${fileName}: missing header row`);
  }
  if (!headers.includes('level') || !headers.includes('season')) {
    throw new Error(`${fileName}: upgrade CSV must include level and season columns`);
  }

  const costHeaders = headers.filter((header) => header.startsWith('cost_'));
  if (costHeaders.length === 0) {
    throw new Error(`${fileName}: upgrade CSV must include at least one cost_ column`);
  }

  const dataRows = parsedRows.filter((_, index) => index !== headerIndex);
  const rows = dataRows.map((row) => {
    const object = rowToObject(row, headers, fileName, true);
    const level = Number(object.level);
    const season = String(object.season || '').trim().toLowerCase();

    if (!Number.isInteger(level) || level < 0) {
      throw new Error(`${fileName}:${row.line}: invalid level: ${object.level}`);
    }
    if (!/^s\d+$/i.test(season)) {
      throw new Error(`${fileName}:${row.line}: invalid season: ${object.season}`);
    }

    return {
      ...object,
      level,
      season,
      category: config.category,
    };
  });

  const bySeason = {};
  rows.forEach((row) => {
    if (!bySeason[row.season]) bySeason[row.season] = [];
    bySeason[row.season].push(row);
  });

  return {
    category: config.category,
    tableKey: config.tableKey,
    rows,
    bySeason,
  };
}

function parseGenericFile(fileName, parsedRows) {
  const [headerRow, ...dataRows] = parsedRows;
  if (!headerRow) throw new Error(`${fileName}: empty CSV`);

  const headers = headerRow.cells.map(normalizeHeader);
  if (headers.some((header) => !header)) {
    throw new Error(`${fileName}:${headerRow.line}: header cells must not be empty`);
  }

  return dataRows.map((row) => rowToObject(row, headers, fileName, false));
}

function buildData() {
  const files = readdirSync(RAW_DIR).filter((fileName) => fileName.toLowerCase().endsWith('.csv')).sort();
  if (files.length === 0) throw new Error(`No CSV files found in ${RAW_DIR}`);

  const output = {
    version: 1,
    metadata: {
      rawDir: 'data/raw',
      sources: {},
    },
    upgradeCosts: {},
    tables: {},
  };

  files.forEach((fileName) => {
    const fullPath = path.join(RAW_DIR, fileName);
    const text = readFileSync(fullPath, 'utf8');
    const parsedRows = parseCsvRows(text, fileName);
    if (parsedRows.length === 0) throw new Error(`${fileName}: empty CSV`);

    const config = UPGRADE_FILES[fileName];
    if (config) {
      const parsed = parseUpgradeFile(fileName, parsedRows, config);
      output.upgradeCosts[parsed.category] = parsed.bySeason;
      output.metadata.sources[fileName] = {
        category: parsed.category,
        tableKey: parsed.tableKey,
        rowCount: parsed.rows.length,
        seasons: Object.fromEntries(
          Object.entries(parsed.bySeason).map(([season, rows]) => [season, rows.length])
        ),
      };
      return;
    }

    const tableName = toTableName(fileName);
    const rows = parseGenericFile(fileName, parsedRows);
    output.tables[tableName] = {
      fileName,
      rows,
    };
    output.metadata.sources[fileName] = {
      tableName,
      rowCount: rows.length,
    };
  });

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Generated ${path.relative(ROOT_DIR, OUTPUT_FILE)} from ${files.length} CSV files`);
}

buildData();

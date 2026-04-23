import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseDir = path.resolve(__dirname, '..');
const projectRootDir = path.resolve(supabaseDir, '..');
const gamesCsvPath = path.join(__dirname, 'games_catalog_template.csv');
const venuesCsvPath = path.join(__dirname, 'venues_dfw_template.csv');
const geocodedVenuesCsvPath = path.join(__dirname, 'venues_dfw_template.geocoded.csv');
const outputPath = path.join(supabaseDir, 'seed.generated.sql');
const geocodeCachePath = path.join(__dirname, '.geocode-cache.json');
const envPath = path.join(projectRootDir, '.env');
const envFileValues = loadDotEnv(envPath);
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  envFileValues.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  envFileValues.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  '';

function parseCsv(text) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      currentField = '';

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows.map((row) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim();
    });

    return record;
  });
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const envText = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function toCsvValue(value) {
  const normalized = value == null ? '' : String(value);

  if (
    normalized.includes(',') ||
    normalized.includes('"') ||
    normalized.includes('\n') ||
    normalized.includes('\r')
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function stringifyCsv(rows) {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header] ?? '')).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

function toSqlText(value) {
  if (value == null || value === '') {
    return 'null';
  }

  return `'${escapeSqlString(String(value))}'`;
}

function toSqlInteger(value) {
  if (value == null || value === '') {
    return 'null';
  }

  return String(Number.parseInt(value, 10));
}

function toSqlFloat(value) {
  if (value == null || value === '') {
    return 'null';
  }

  return String(Number.parseFloat(value));
}

function toSqlTextArray(pipeDelimitedValue) {
  const items = pipeDelimitedValue
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return "array[]::text[]";
  }

  return `array[${items.map((item) => toSqlText(item)).join(', ')}]`;
}

function toSqlJsonObject(row, allowedKeys) {
  const entries = allowedKeys
    .map((key) => [key, row[key]?.trim() ?? ''])
    .filter(([, value]) => value.length > 0);

  if (entries.length === 0) {
    return "'{}'::jsonb";
  }

  const parts = entries.map(
    ([key, value]) => `${toSqlText(key)}, ${toSqlText(value)}`,
  );

  return `jsonb_build_object(${parts.join(', ')})`;
}

function loadGeocodeCache() {
  if (!fs.existsSync(geocodeCachePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(geocodeCachePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache) {
  fs.writeFileSync(geocodeCachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function buildVenueAddress(row) {
  return [
    row.street_address,
    row.city,
    row.region,
    row.postal_code,
    row.country || 'US',
  ]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

async function geocodeAddress(address) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. The seed builder uses the Supabase geocode function.',
    );
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/geocode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
    },
    body: JSON.stringify({ query: address }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase geocode failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const latitude = data?.latitude;
  const longitude = data?.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Supabase geocode returned invalid coordinates.');
  }

  return {
    latitude,
    longitude,
  };
}

async function enrichVenueRowsWithGeocoding(venueRows) {
  const cache = loadGeocodeCache();
  const enrichedRows = [];

  for (const row of venueRows) {
    if (row.latitude && row.longitude) {
      enrichedRows.push(row);
      continue;
    }

    const address = buildVenueAddress(row);

    if (!address || !supabaseUrl || !supabaseKey) {
      enrichedRows.push(row);
      continue;
    }

    const cacheKey = row.slug || address;

    if (cache[cacheKey]?.latitude && cache[cacheKey]?.longitude) {
      enrichedRows.push({
        ...row,
        latitude: String(cache[cacheKey].latitude),
        longitude: String(cache[cacheKey].longitude),
      });
      continue;
    }

    try {
      const coordinates = await geocodeAddress(address);

      cache[cacheKey] = coordinates;
      enrichedRows.push({
        ...row,
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude),
      });
    } catch (error) {
      console.warn(
        `Could not geocode venue "${row.name || row.slug || address}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      enrichedRows.push(row);
    }
  }

  saveGeocodeCache(cache);
  fs.writeFileSync(geocodedVenuesCsvPath, stringifyCsv(enrichedRows), 'utf8');

  return enrichedRows;
}

function buildGamesSql(gameRows) {
  const validRows = gameRows.filter((row) => row.slug && row.title);

  if (validRows.length === 0) {
    return '-- No valid game rows were found in games_catalog_template.csv\n';
  }

  const valuesSql = validRows
    .map(
      (row) => `  (
    ${toSqlText(row.slug)},
    ${toSqlText(row.title)},
    ${toSqlText(row.manufacturer)},
    ${toSqlInteger(row.release_year)},
    ${toSqlTextArray(row.aliases)}
  )`,
    )
    .join(',\n');

  return `insert into public.games (slug, title, manufacturer, release_year, aliases)
values
${valuesSql}
on conflict (slug) do update
set
  title = excluded.title,
  manufacturer = excluded.manufacturer,
  release_year = excluded.release_year,
  aliases = excluded.aliases;
`;
}

function buildVenuesSql(venueRows) {
  const validRows = venueRows.filter(
    (row) =>
      row.slug &&
      row.name &&
      row.city &&
      row.region &&
      row.latitude &&
      row.longitude,
  );

  if (validRows.length === 0) {
    return '-- No valid venue rows with coordinates were found in venues_dfw_template.csv\n';
  }

  const valuesSql = validRows
    .map(
      (row) => `  (
    ${toSqlText(row.slug)},
    ${toSqlText(row.name)},
    ${toSqlText(row.street_address)},
    ${toSqlText(row.city)},
    ${toSqlText(row.region)},
    ${toSqlText(row.postal_code)},
    ${toSqlText(row.country || 'US')},
    ${toSqlText(row.source || 'seed')},
    ${toSqlText(row.status || 'active')},
    extensions.st_setsrid(
      extensions.st_makepoint(${toSqlFloat(row.longitude)}, ${toSqlFloat(row.latitude)}),
      4326
    )::extensions.geography,
    ${toSqlJsonObject(row, ['website', 'notes'])}
  )`,
    )
    .join(',\n');

  return `insert into public.venues (
  slug,
  name,
  street_address,
  city,
  region,
  postal_code,
  country,
  source,
  status,
  location,
  metadata
)
values
${valuesSql}
on conflict (slug) do update
set
  name = excluded.name,
  street_address = excluded.street_address,
  city = excluded.city,
  region = excluded.region,
  postal_code = excluded.postal_code,
  country = excluded.country,
  source = excluded.source,
  status = excluded.status,
  location = excluded.location,
  metadata = excluded.metadata;
`;
}

function buildWarnings(gameRows, venueRows) {
  const warnings = [];

  gameRows.forEach((row, index) => {
    if (!row.slug || !row.title) {
      warnings.push(
        `-- Skipped game row ${index + 2}: missing required slug/title`,
      );
    }
  });

  venueRows.forEach((row, index) => {
    if (
      !row.slug ||
      !row.name ||
      !row.city ||
      !row.region ||
      !row.latitude ||
      !row.longitude
    ) {
      warnings.push(
        `-- Skipped venue row ${index + 2}: missing required slug/name/city/region/latitude/longitude`,
      );
    }
  });

  return warnings.length > 0 ? `${warnings.join('\n')}\n\n` : '';
}

const gamesCsv = fs.readFileSync(gamesCsvPath, 'utf8');
const venuesCsv = fs.readFileSync(venuesCsvPath, 'utf8');
const gameRows = parseCsv(gamesCsv);
const venueRows = parseCsv(venuesCsv);
const enrichedVenueRows = await enrichVenueRowsWithGeocoding(venueRows);

const output = `-- Generated by supabase/seed-data/build-seed-sql.mjs
-- Review before applying. This file intentionally covers games and venues only.
-- Inventory should continue to come from Scout Mode reports and approvals.
-- Missing venue coordinates can be auto-geocoded through the Supabase geocode
-- Edge Function when EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are
-- available in the local environment or the project .env file.

begin;

${buildWarnings(gameRows, enrichedVenueRows)}${buildGamesSql(gameRows)}
${buildVenuesSql(enrichedVenueRows)}
commit;
`;

fs.writeFileSync(outputPath, output, 'utf8');

console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
console.log(
  `Wrote geocoded venue CSV to ${path.relative(process.cwd(), geocodedVenuesCsvPath)}`,
);

#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const DEFAULT_OUTPUT = 'supabase/seed-data/mame-game-catalog.generated.sql';

const EXCLUDED_TITLE_PATTERN =
  /(^[^a-z0-9]+|slot|poker|blackjack|casino|fruit|mahjong|pachinko|pachislo|bingo|lottery|quiz|trivia|medal|keyboard|calculator|printer|terminal|bios|pinball|plug ?& ?play|plug and play|pocket player|mini arcade|my arcade|tiger|jakks|radica|coleco|scorpion|fruit machine|educational computer|electronic typewriter)\b/i;

const EXCLUDED_SOURCE_PATTERN =
  /(^|\/)(aristocrat|barcrest|bfm|maygay|igt|mpu4|mpu5|pinball|handheld|tvgames|skeleton|adds|acorn|alesis|apple|amstrad|att|commodore|sinclair|msx|sony|trs|pc|pce|palm|psion|nokia|ti|sharp|tandy|tektronix|thomson|trainer|roland|saitek|sgi|ussr|virtual|vtech|yeno|ncd|facit|esprit|interton|nintendo\/nes|nintendo\/snes|nintendo\/gameboy|sega\/megadriv|sega\/sms|coleco|mattel|epoch|jpm)\b/i;

const CATEGORY_RULES = [
  ['Fighting', /\b(street fighter|mortal kombat|tekken|king of fighters|marvel vs|capcom vs|killer instinct|virtua fighter|soul ?calibur|guilty gear|samurai shodown|darkstalkers|fatal fury)\b/i],
  ['Rhythm', /\b(dance dance|ddr|pump it up|beatmania|jubeat|sound voltex|taiko|maimai|groove coaster|wacca|museca|pop'n)\b/i],
  ['Light gun', /\b(time crisis|house of the dead|area 51|terminator|lethal enforcers|jurassic park|virtua cop|operation wolf|gunblade)\b/i],
  ['Racing', /\b(daytona|cruis'?n|outrun|ridge racer|crazy taxi|hydro thunder|sega rally|initial d|sprint|racing|driver)\b/i],
  ['Sports', /\b(nba jam|nfl blitz|golden tee|track ?& ?field|baseball|football|soccer|tennis|bowling|golf|hangtime)\b/i],
  ['Beat em up', /\b(final fight|simpsons|teenage mutant ninja|tmnt|x-men|gauntlet|double dragon|streets of rage|dungeons & dragons)\b/i],
  ['Shooter', /\b(galaga|space invaders|defender|robotron|raiden|1942|r-type|rtype|metal slug|contra|gradius|darius|ikaruga|shooter)\b/i],
  ['Platformer', /\b(donkey kong|mario bros|bubble bobble|ghosts'?n goblins|joust|rastan|contra)\b/i],
  ['Puzzle', /\b(tetris|q\*?bert|columns|puzzle|puyo|bubble bobble|magical drop)\b/i],
  ['Classic', /\b(pac-man|ms\.? pac|galaga|donkey kong|frogger|centipede|asteroids|dig dug|defender|joust|robotron|q\*?bert|tempest|classic)\b/i],
];

const CANONICAL_SLUG_OVERRIDES = new Map([
  ['dragonslair', 'dragons-lair'],
  ['houseofthedead2', 'house-of-the-dead-2'],
  ['qbert', 'qbert'],
  ['roadblasters', 'roadblasters'],
  ['satanshollow', 'satans-hollow'],
  ['smashtv', 'smash-tv'],
  ['soulcalibur', 'soulcalibur'],
  ['soulcaliburii', 'soulcalibur-ii'],
  ['starwars', 'star-wars-1983'],
  ['terminator2judgmentday', 'terminator-2-judgment-day-arcade'],
]);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function getPositionalInput() {
  return process.argv
    .slice(2)
    .find((argument) => !argument.startsWith('-'));
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function showHelp() {
  console.log(`
Usage:
  node scripts/build-mame-game-seed.mjs --input path/to/mame.xml [--output supabase/seed-data/mame-game-catalog.generated.sql] [--chunk-size 500] [--include-clones] [--include-mechanical]

Input:
  Generate XML with MAME:
    mame -listxml > mame.xml

Output:
  Idempotent SQL that inserts/updates public.games only. It does not create venue inventory.
  By default it skips clones, mechanical/pinball sets, gambling games, handhelds,
  plug-and-play TV games, and home computer/console entries.
`);
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getAttribute(block, name) {
  const match = block.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

function getTag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? decodeXml(match[1].trim()) : null;
}

function normalizeTitle(title) {
  return title
    .replace(/\s*\([^)]*(set|version|ver\.?|revision|rev\.?|bootleg|prototype|world|usa|us|japan|europe|asia|korea|china|taiwan|location test|hack)[^)]*\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function getCanonicalSlug(title) {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return CANONICAL_SLUG_OVERRIDES.get(normalizedTitle) ?? slugify(title);
}

function sqlString(value) {
  if (value === null || value === undefined || value === '') {
    return 'null';
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlStringArray(values) {
  const uniqueValues = [...new Set(values.filter(Boolean))];

  if (uniqueValues.length === 0) {
    return "'{}'::text[]";
  }

  return `array[${uniqueValues.map(sqlString).join(', ')}]`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function inferCategories(title) {
  const categories = CATEGORY_RULES
    .filter(([, pattern]) => pattern.test(title))
    .map(([category]) => category);

  return categories.length > 0 ? [...new Set(categories)] : ['Arcade'];
}

function buildCatalog(xml, { includeClones, includeMechanical }) {
  const machineBlocks = xml.match(/<machine\b[\s\S]*?<\/machine>/g) ?? [];
  const catalog = new Map();

  for (const block of machineBlocks) {
    const machineName = getAttribute(block, 'name');
    const cloneOf = getAttribute(block, 'cloneof');
    const sourceFile = getAttribute(block, 'sourcefile') ?? '';
    const isDevice = getAttribute(block, 'isdevice') === 'yes';
    const isMechanical = getAttribute(block, 'ismechanical') === 'yes';
    const runnable = getAttribute(block, 'runnable');
    const rawTitle = getTag(block, 'description');
    const yearText = getTag(block, 'year');
    const manufacturer = getTag(block, 'manufacturer');

    if (!machineName || !rawTitle || isDevice || runnable === 'no') {
      continue;
    }

    if (isMechanical && !includeMechanical) {
      continue;
    }

    if (cloneOf && !includeClones) {
      continue;
    }

    if (EXCLUDED_SOURCE_PATTERN.test(sourceFile)) {
      continue;
    }

    const title = normalizeTitle(rawTitle);

    if (!title || EXCLUDED_TITLE_PATTERN.test(title)) {
      continue;
    }

    const slug = getCanonicalSlug(title);
    const releaseYear = Number(yearText);
    const existing = catalog.get(slug);
    const mameNames = existing?.mameNames ?? [];
    const aliases = existing?.aliases ?? [];

    if (title !== rawTitle) {
      aliases.push(rawTitle);
    }

    mameNames.push(machineName);

    catalog.set(slug, {
      aliases,
      categories: existing?.categories ?? inferCategories(title),
      manufacturer: existing?.manufacturer ?? manufacturer,
      mameNames,
      releaseYear: existing?.releaseYear ?? (Number.isFinite(releaseYear) ? releaseYear : null),
      sourceFiles: [...new Set([...(existing?.sourceFiles ?? []), sourceFile].filter(Boolean))],
      slug,
      title: existing?.title ?? title,
    });
  }

  return [...catalog.values()].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

function buildSql(catalog, { inputFile, includeClones, includeMechanical }) {
  const rows = catalog.map((game) => `  (
    ${sqlString(game.slug)},
    ${sqlString(game.title)},
    ${sqlString(game.manufacturer)},
    ${game.releaseYear ?? 'null'},
    ${sqlStringArray(game.aliases)},
    ${sqlStringArray(game.categories)},
    ${sqlJson({ mame: game.mameNames })},
    ${sqlJson({
      excluded_noise: [
        'gambling',
        'handheld',
        'home-computer',
        'home-console',
        'pinball',
        'plug-and-play',
      ],
      include_mechanical: includeMechanical,
      import_policy: includeClones ? 'parents-and-clones' : 'parents-only',
      source: 'mame-listxml',
      source_file: basename(inputFile),
      source_files: game.sourceFiles,
    })}
  )`);

  return `-- Generated by scripts/build-mame-game-seed.mjs
-- Source: ${inputFile}
-- Games: ${catalog.length}
-- This file inserts/updates public.games only. It does not create venue inventory.

begin;

insert into public.games as g (
  slug,
  title,
  manufacturer,
  release_year,
  aliases,
  categories,
  external_ids,
  metadata
)
values
${rows.join(',\n')}
on conflict (slug) do update
set
  title = excluded.title,
  manufacturer = coalesce(g.manufacturer, excluded.manufacturer),
  release_year = coalesce(g.release_year, excluded.release_year),
  aliases = (
    select array(
      select distinct alias_value
      from unnest(coalesce(g.aliases, '{}'::text[]) || excluded.aliases) as merged_aliases(alias_value)
      where alias_value <> ''
      order by alias_value
    )
  ),
  categories = (
    select array(
      select distinct category_value
      from unnest(coalesce(g.categories, '{}'::text[]) || excluded.categories) as merged_categories(category_value)
      where category_value <> ''
      order by category_value
    )
  ),
  external_ids = jsonb_set(
    coalesce(g.external_ids, '{}'::jsonb) || (excluded.external_ids - 'mame'),
    '{mame}',
    (
      select to_jsonb(array(
        select distinct mame_id
        from jsonb_array_elements_text(coalesce(g.external_ids -> 'mame', '[]'::jsonb) || coalesce(excluded.external_ids -> 'mame', '[]'::jsonb)) as merged_mame_ids(mame_id)
        order by mame_id
      ))
    ),
    true
  ),
  metadata = coalesce(g.metadata, '{}'::jsonb) || excluded.metadata;

commit;
`;
}

function getChunkOutputPath(outputFile, chunkIndex) {
  const suffix = String(chunkIndex + 1).padStart(3, '0');

  if (outputFile.endsWith('.sql')) {
    return outputFile.replace(/\.sql$/, `.${suffix}.sql`);
  }

  return `${outputFile}.${suffix}.sql`;
}

if (hasFlag('--help') || hasFlag('-h')) {
  showHelp();
  process.exit(0);
}

const inputFile = getArgValue('--input') ?? getPositionalInput();
const outputFile = getArgValue('--output') ?? DEFAULT_OUTPUT;
const chunkSizeText = getArgValue('--chunk-size');
const chunkSize = chunkSizeText ? Number(chunkSizeText) : 0;
const includeClones = hasFlag('--include-clones');
const includeMechanical = hasFlag('--include-mechanical');

if (!inputFile) {
  showHelp();
  process.exit(1);
}

const xml = readFileSync(inputFile, 'utf8');
const catalog = buildCatalog(xml, { includeClones, includeMechanical });

if (Number.isFinite(chunkSize) && chunkSize > 0) {
  const chunkCount = Math.ceil(catalog.length / chunkSize);

  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = catalog.slice(index * chunkSize, (index + 1) * chunkSize);
    const chunkOutputFile = getChunkOutputPath(outputFile, index);
    const sql = buildSql(chunk, { includeClones, includeMechanical, inputFile });

    writeFileSync(chunkOutputFile, sql);
  }

  console.log(
    `Generated ${chunkCount} chunk files from ${catalog.length} games using chunk size ${chunkSize}.`,
  );
  process.exit(0);
}

const sql = buildSql(catalog, { includeClones, includeMechanical, inputFile });

writeFileSync(outputFile, sql);

console.log(`Generated ${outputFile} with ${catalog.length} games.`);

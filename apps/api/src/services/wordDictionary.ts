import fs from "fs";
import path from "path";

type WordIndex = {
  all: string[];
  byLength: Map<number, string[]>;
};

const cachedIndex: { value: WordIndex | null } = { value: null };

const getWordListPath = () => {
  const candidates = [
    process.env.WORD_LIST_PATH,
    path.resolve(process.cwd(), "src", "assets", "words.txt"),
    path.resolve(process.cwd(), "apps", "api", "src", "assets", "words.txt"),
    path.resolve(__dirname, "..", "assets", "words.txt"),
    "/usr/share/dict/words",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const loadWords = (): WordIndex => {
  if (cachedIndex.value) {
    return cachedIndex.value;
  }

  const wordListPath = getWordListPath();
  if (!wordListPath) {
    throw new Error("Word list not found");
  }

  const raw = fs.readFileSync(wordListPath, "utf8");
  const unique = new Set<string>();
  const byLength = new Map<number, string[]>();

  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (!word) {
      continue;
    }
    if (!/^[a-z]+$/.test(word)) {
      continue;
    }
    if (unique.has(word)) {
      continue;
    }
    unique.add(word);
  }

  const all = Array.from(unique).sort((a, b) =>
    a.length === b.length ? a.localeCompare(b) : a.length - b.length
  );

  for (const word of all) {
    const length = word.length;
    const bucket = byLength.get(length);
    if (bucket) {
      bucket.push(word);
    } else {
      byLength.set(length, [word]);
    }
  }

  const index = { all, byLength };
  cachedIndex.value = index;
  return index;
};

export const getWordsByLength = (length: number): string[] => {
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error("Word length must be a positive number");
  }
  const index = loadWords();
  return index.byLength.get(length) ?? [];
};

export const getRandomWordByLength = (length: number): string | null => {
  const words = getWordsByLength(length);
  if (words.length === 0) {
    return null;
  }
  const choice = Math.floor(Math.random() * words.length);
  return words[choice] ?? null;
};

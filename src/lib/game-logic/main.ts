import { Country, getCountryByCode } from "./data/countries";
import { getDifficultyCountries } from "./data/difficultyCategories";
import {
  FLAG_COLOR_PATTERNS,
  FLAG_ELEMENTS,
  COMMON_SUFFIXES,
  GEOGRAPHIC_NEIGHBORS,
  SUB_REGIONS,
  SIMILAR_FLAGS,
  DISTINCTIVE_FLAGS,
} from "./data/flagPatterns";
import { EXPERT_COUNTRY_POOLS } from "./data/expertPools";
import { HISTORICAL_CONFUSION_PAIRS } from "./data/historicalConfusion";
import {
  DIFFICULTY_LEVELS,
  Difficulty,
  DEFAULT_DIFFICULTY,
  EXPERT_DIFFICULTY,
  HARD_DIFFICULTY,
  MEDIUM_DIFFICULTY,
} from "../constants";
import { SIMILAR_NAMES } from "./data/similarNames";

interface QuestionData {
  difficulty: Difficulty;
  currentCountry: Country;
  options: Country[];
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sampleOne<T>(array: T[]): T | undefined {
  if (!array.length) return undefined;
  const idx = Math.floor(Math.random() * array.length);
  return array[idx];
}

// ============================================================================
// DIFFICULTY AND SETTINGS
// ============================================================================

export const getDifficultySettings = (difficulty: Difficulty) => {
  const countries = getDifficultyCountries(difficulty);
  const settings = {
    [DEFAULT_DIFFICULTY]: { count: 15, label: "Easy" },
    [MEDIUM_DIFFICULTY]: { count: 25, label: "Medium" },
    [HARD_DIFFICULTY]: {
      count: countries.length,
      label: `Hard`,
    },
    [EXPERT_DIFFICULTY]: {
      count: countries.length,
      label: `Expert`,
    },
  };
  return settings[difficulty];
};

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

const getSimilarFlags = (countryCode: string): string[] => {
  return SIMILAR_FLAGS[countryCode] || [];
};

const getSimilarNames = (countryName: string): string[] => {
  return SIMILAR_NAMES[countryName] || [];
};

const isDistinctiveFlag = (countryCode: string): boolean => {
  return DISTINCTIVE_FLAGS.includes(countryCode);
};

const weightedRandomSelect = (items: Country[], weights: number[]) => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
};

const calculateOptionSimilarityScore = (
  correctCountry: Country,
  candidateCountry: Country,
  difficulty: Difficulty
): number => {
  if (difficulty === EXPERT_DIFFICULTY) {
    return calculateExpertOptionSimilarityScore(
      correctCountry,
      candidateCountry
    );
  }

  let similarityScore = 0;
  const correctRegion = getCountryByCode(correctCountry.code)?.region;
  const candidateRegion = getCountryByCode(candidateCountry.code)?.region;
  const similarFlags = getSimilarFlags(correctCountry.code);
  const similarNames = getSimilarNames(correctCountry.name);

  if (correctRegion === candidateRegion) {
    similarityScore +=
      difficulty === HARD_DIFFICULTY
        ? 40
        : difficulty === MEDIUM_DIFFICULTY
        ? 30
        : 20;
  }

  if (similarFlags.includes(candidateCountry.code)) {
    similarityScore += 50;
  }

  if (similarNames.includes(candidateCountry.name)) {
    similarityScore += 35;
  }

  // Expert mode: Additional similarity factors
  if (difficulty === EXPERT_DIFFICULTY) {
    // Same starting letter bonus
    if (correctCountry.name[0] === candidateCountry.name[0]) {
      similarityScore += 25;
    }

    // Similar name length bonus
    const lengthDiff = Math.abs(
      correctCountry.name.length - candidateCountry.name.length
    );
    if (lengthDiff <= 2) {
      similarityScore += 20;
    }

    // Same ending pattern bonus
    if (
      correctCountry.name.endsWith(candidateCountry.name.slice(-3)) ||
      candidateCountry.name.endsWith(correctCountry.name.slice(-3))
    ) {
      similarityScore += 30;
    }

    // Similar syllable count bonus
    const correctSyllables = correctCountry.name.replace(
      /[^aeiou]/gi,
      ""
    ).length;
    const candidateSyllables = candidateCountry.name.replace(
      /[^aeiou]/gi,
      ""
    ).length;
    const syllableDiff = Math.abs(correctSyllables - candidateSyllables);
    if (syllableDiff <= 1) {
      similarityScore += 15;
    }

    // Advanced linguistic similarities
    // Shared word bonus (e.g., "United", "Republic", "Democratic")
    const correctWords = correctCountry.name.toLowerCase().split(" ");
    const candidateWords = candidateCountry.name.toLowerCase().split(" ");
    const sharedWords = correctWords.filter((word) =>
      candidateWords.includes(word)
    );
    if (sharedWords.length > 0) {
      similarityScore += sharedWords.length * 20;
    }

    // Similar word count bonus
    const wordCountDiff = Math.abs(correctWords.length - candidateWords.length);
    if (wordCountDiff <= 1) {
      similarityScore += 15;
    }

    // Flag color pattern analysis
    for (const [pattern, codes] of Object.entries(FLAG_COLOR_PATTERNS)) {
      if (
        codes.includes(correctCountry.code) &&
        codes.includes(candidateCountry.code)
      ) {
        similarityScore += 40;
        break;
      }
    }

    // Flag element similarities (stars, crosses, stripes, etc.)
    for (const [element, codes] of Object.entries(FLAG_ELEMENTS)) {
      if (
        codes.includes(correctCountry.code) &&
        codes.includes(candidateCountry.code)
      ) {
        similarityScore += 35;
        break;
      }
    }

    // Geographic proximity (neighboring countries)
    if (
      GEOGRAPHIC_NEIGHBORS[correctCountry.code]?.includes(candidateCountry.code)
    ) {
      similarityScore += 45;
    }

    // Sub-regional similarity bonus
    for (const [subRegion, codes] of Object.entries(SUB_REGIONS)) {
      if (
        codes.includes(correctCountry.code) &&
        codes.includes(candidateCountry.code)
      ) {
        similarityScore += 35;
        break;
      }
    }
  }

  if (
    (difficulty === HARD_DIFFICULTY || difficulty === EXPERT_DIFFICULTY) &&
    isDistinctiveFlag(candidateCountry.code)
  ) {
    similarityScore -= difficulty === EXPERT_DIFFICULTY ? 60 : 30;
  }

  if (difficulty === EXPERT_DIFFICULTY) {
    if (
      correctRegion !== candidateRegion &&
      !similarFlags.includes(candidateCountry.code) &&
      !similarNames.includes(candidateCountry.name)
    ) {
      similarityScore -= 50;
    }
  }

  // Random bonus for variety
  similarityScore +=
    Math.random() * (difficulty === EXPERT_DIFFICULTY ? 5 : 15);

  return Math.max(similarityScore, 1);
};

// ======================
// COUNTRY SELECTION HELPERS
// ======================

const selectCorrectCountry = (
  difficulty: Difficulty,
  remainingCountries: Country[]
): Country => {
  if (difficulty === EXPERT_DIFFICULTY) {
    const pools = EXPERT_COUNTRY_POOLS;
    if (Math.random() < 0.7) {
      const challengingCountries = remainingCountries.filter((country) =>
        Object.values(pools).some((pool) => pool.includes(country.code))
      );
      if (challengingCountries.length > 0) {
        return challengingCountries[
          Math.floor(Math.random() * challengingCountries.length)
        ];
      }
    }
  }
  return remainingCountries[
    Math.floor(Math.random() * remainingCountries.length)
  ];
};

// ======================
// DISTRACTOR GENERATION HELPERS
// ======================

const generateDistractors = (
  correctCountry: Country,
  availableCountries: Country[],
  difficulty: Difficulty
): Country[] => {
  const incorrectOptions: Country[] = [];
  const candidateCountries = availableCountries.filter(
    (c) => c.code !== correctCountry.code
  );
  const candidatesWithScores = candidateCountries.map((candidate) => ({
    country: candidate,
    similarityScore: calculateOptionSimilarityScore(
      correctCountry,
      candidate,
      difficulty
    ),
  }));
  const minScoreThreshold = difficulty === EXPERT_DIFFICULTY ? 60 : 1;
  const viableCandidates = candidatesWithScores.filter(
    (c) => c.similarityScore >= minScoreThreshold
  );
  const finalCandidates =
    difficulty === EXPERT_DIFFICULTY
      ? viableCandidates.length >= 3
        ? viableCandidates
        : candidatesWithScores.filter((c) => c.similarityScore >= 40)
      : viableCandidates.length >= 3
      ? viableCandidates
      : candidatesWithScores;

  if (difficulty === EXPERT_DIFFICULTY && finalCandidates.length > 0) {
    // Sort candidates by descending similarity score
    const sortedCandidates = [...finalCandidates].sort(
      (a, b) => b.similarityScore - a.similarityScore
    );
    // Always include the top 2 most similar countries
    for (let i = 0; i < 2 && i < sortedCandidates.length; i++) {
      incorrectOptions.push(sortedCandidates[i].country);
    }
    // For the 3rd distractor, randomly pick from the next 5–10 most similar (not already chosen)
    const poolStart = 2;
    const poolEnd = Math.min(10, sortedCandidates.length);
    const pool = sortedCandidates
      .slice(poolStart, poolEnd)
      .filter(
        (c) => !incorrectOptions.find((option) => option.code === c.country.code)
      );
    if (pool.length > 0) {
      const sampled = sampleOne(pool);
      if (sampled) incorrectOptions.push(sampled.country);
    }
    // If still not enough, fill with next most similar
    while (incorrectOptions.length < 3 && poolStart < sortedCandidates.length) {
      const next = sortedCandidates[poolStart + incorrectOptions.length - 2];
      if (
        next &&
        !incorrectOptions.find((option) => option.code === next.country.code)
      ) {
        incorrectOptions.push(next.country);
      } else {
        break;
      }
    }
  } else {
    // Original logic for other difficulties
    // Ensure at least one very similar option (high similarity)
    const highSimilarityCandidates = finalCandidates.filter(
      (c) => c.similarityScore >= 60
    );
    if (highSimilarityCandidates.length > 0) {
      const highSimilarityCountry =
        highSimilarityCandidates[
          Math.floor(Math.random() * highSimilarityCandidates.length)
        ].country;
      incorrectOptions.push(highSimilarityCountry);
    }
    // Ensure at least one moderately similar option (medium similarity)
    if (incorrectOptions.length < 3) {
      const mediumSimilarityCandidates = finalCandidates.filter(
        (c) =>
          c.similarityScore >= 30 &&
          c.similarityScore < 60 &&
          !incorrectOptions.find((option) => option.code === c.country.code)
      );
      if (mediumSimilarityCandidates.length > 0) {
        const mediumSimilarityCountry =
          mediumSimilarityCandidates[
            Math.floor(Math.random() * mediumSimilarityCandidates.length)
          ].country;
        incorrectOptions.push(mediumSimilarityCountry);
      }
    }
  }
  while (incorrectOptions.length < 3 && finalCandidates.length > 0) {
    const availableCandidates = finalCandidates.filter(
      (c) => !incorrectOptions.find((option) => option.code === c.country.code)
    );
    if (availableCandidates.length === 0) break;
    const countries = availableCandidates.map((c) => c.country);
    const weights = availableCandidates.map((c) =>
      difficulty === EXPERT_DIFFICULTY
        ? Math.pow(c.similarityScore, 2)
        : c.similarityScore
    );
    const selectedCountry = weightedRandomSelect(countries, weights);
    incorrectOptions.push(selectedCountry);
  }
  while (
    incorrectOptions.length < 3 &&
    candidateCountries.length > incorrectOptions.length
  ) {
    const remainingCandidates = candidateCountries.filter(
      (c) => !incorrectOptions.find((option) => option.code === c.code)
    );
    if (remainingCandidates.length === 0) break;
    const nextCandidate =
      remainingCandidates[
        Math.floor(Math.random() * remainingCandidates.length)
      ];
    incorrectOptions.push(nextCandidate);
  }
  return incorrectOptions.slice(0, 3);
};

// ============================================================================
// MAIN GAME LOGIC
// ============================================================================

export const generateQuestion = (
  difficulty: Difficulty,
  usedCountries: Set<string> = new Set()
): QuestionData | null => {
  const availableCountries = getDifficultyCountries(difficulty);
  const remainingCountries = availableCountries.filter(
    (country) => !usedCountries.has(country.code)
  );
  if (remainingCountries.length === 0) {
    return null;
  }
  const correctCountry = selectCorrectCountry(difficulty, remainingCountries);
  const incorrectOptions = generateDistractors(
    correctCountry,
    availableCountries,
    difficulty
  );
  const allOptions = [correctCountry, ...incorrectOptions];
  const shuffledOptions = shuffleArray(allOptions);
  return {
    difficulty,
    currentCountry: correctCountry,
    options: shuffledOptions,
  };
};

export function parseDifficultyFromQuery(
  queryValue: string | undefined
): Difficulty {
  const allowed = DIFFICULTY_LEVELS;
  if (queryValue && allowed.includes(queryValue as Difficulty)) {
    return queryValue as Difficulty;
  }
  return DEFAULT_DIFFICULTY;
}

// ============================================================================
// EXPERT MODE SCORING FUNCTIONS
// ============================================================================

const getPoolSimilarityBonus = (
  correctCode: string,
  candidateCode: string,
  pools: { [key: string]: string[] }
): number => {
  let bonus = 0;

  Object.entries(pools).forEach(([poolName, countries]) => {
    if (countries.includes(correctCode) && countries.includes(candidateCode)) {
      switch (poolName) {
        case "confusingFlags":
          bonus += 120;
          break;
        case "confusingNames":
          bonus += 110;
          break;
        case "lesserKnown":
          bonus += 40;
          break;
        case "panAfrican":
          bonus += 60;
          break;
        case "panArab":
          bonus += 70;
          break;
        case "nordic":
          bonus += 80;
          break;
        case "caribbean":
          bonus += 65;
          break;
        default:
          bonus += 60;
          break;
      }
    }
  });

  return bonus;
};

// New function for historical confusion patterns
const getHistoricalConfusionBonus = (
  correctCode: string,
  candidateCode: string
): number => {
  const confusedWith = HISTORICAL_CONFUSION_PAIRS[correctCode];
  if (confusedWith && confusedWith.includes(candidateCode)) {
    return 80; // Increased from 60
  }
  return 0;
};

const calculateExpertOptionSimilarityScore = (
  correctCountry: Country,
  candidateCountry: Country
): number => {
  let score = 0;
  const pools = EXPERT_COUNTRY_POOLS;

  // Base regional similarity (higher weight)
  const correctRegion = getCountryByCode(correctCountry.code)?.region;
  const candidateRegion = getCountryByCode(candidateCountry.code)?.region;

  if (correctRegion === candidateRegion) {
    score += 100;
  }

  // Flag pattern similarity (very high weight)
  const similarFlags = getSimilarFlags(correctCountry.code);
  if (similarFlags.includes(candidateCountry.code)) {
    score += 150;
  }

  // Name confusion factor
  const similarNames = getSimilarNames(correctCountry.name);
  if (similarNames.includes(candidateCountry.name)) {
    score += 80;
  }

  // Same starting letter bonus (higher than before)
  if (correctCountry.name[0] === candidateCountry.name[0]) {
    score += 50;
  }

  // Enhanced name length similarity
  const lengthDiff = Math.abs(
    correctCountry.name.length - candidateCountry.name.length
  );
  if (lengthDiff === 0) score += 45;
  else if (lengthDiff === 1) score += 35;
  else if (lengthDiff === 2) score += 25;

  // Enhanced ending pattern matching
  const correctEnding = correctCountry.name.slice(-3).toLowerCase();
  const candidateEnding = candidateCountry.name.slice(-3).toLowerCase();
  if (correctEnding === candidateEnding) {
    score += 60;
  }

  // Common suffix patterns (enhanced)
  const correctSuffix = COMMON_SUFFIXES.find((suffix) =>
    correctCountry.name.toLowerCase().endsWith(suffix)
  );
  if (
    correctSuffix &&
    candidateCountry.name.toLowerCase().endsWith(correctSuffix)
  ) {
    score += 70;
  }

  // Enhanced vowel pattern similarity
  const getVowelPattern = (name: string) =>
    name.toLowerCase().replace(/[^aeiou]/g, "");
  const correctVowels = getVowelPattern(correctCountry.name);
  const candidateVowels = getVowelPattern(candidateCountry.name);
  if (correctVowels === candidateVowels) {
    score += 40;
  } else if (correctVowels.length === candidateVowels.length) {
    score += 20;
  }

  // Word count similarity (for multi-word countries)
  const correctWords = correctCountry.name.split(" ").length;
  const candidateWords = candidateCountry.name.split(" ").length;
  if (correctWords === candidateWords && correctWords > 1) {
    score += 35;
  }

  // Special country pool bonuses
  score += getPoolSimilarityBonus(
    correctCountry.code,
    candidateCountry.code,
    pools
  );

  // Bonus for countries that are historically confused
  score += getHistoricalConfusionBonus(
    correctCountry.code,
    candidateCountry.code
  );

  // Balanced random element (reduced for more consistent difficulty)
  score += Math.random() * 5;

  return Math.max(score, 1);
};

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "./logger";

type Posting = { documentId: number; weight: number };
type HistoricalDocument = {
  category: string;
  hasResolution: boolean;
  norm: number;
};
type HistoricalCorpus = {
  documents: HistoricalDocument[];
  idf: Map<string, number>;
  postings: Map<string, Posting[]>;
  categoryCounts: Map<string, number>;
};
export type SimilarHistoricalIncident = {
  title: string;
  category: string;
  resolution: string | null;
  similarity: number;
};
export type HistoricalAnalysis = {
  predictedCategory: string;
  confidence: number;
  method: string;
  rationale: string;
  similarIncidents: SimilarHistoricalIncident[];
  recommendedResolution: string;
  resolutionMethod: string;
};

const DATA_RELATIVE_PATH =
  "source/ai-models/data/processed/clean_tickets.csv";
const DATA_PATH_CANDIDATES = [
  resolve(process.cwd(), "dist/data/clean_tickets.csv"),
  resolve(process.cwd(), "artifacts/api-server/dist/data/clean_tickets.csv"),
  resolve(process.cwd(), "../incidai", DATA_RELATIVE_PATH),
  resolve(process.cwd(), "artifacts/incidai", DATA_RELATIVE_PATH),
  resolve(process.cwd(), "../../artifacts/incidai", DATA_RELATIVE_PATH),
];
const DATA_PATH =
  DATA_PATH_CANDIDATES.find((candidate) => existsSync(candidate)) ??
  DATA_PATH_CANDIDATES[0];
const METHOD =
  "TF-IDF lexical retrieval over the processed historical ticket dataset";
const STOP_WORDS = new Set(
  `a an and are as at be been by can could did do does for from had has have he her here him his how i if in into is it its may me my no not of on or our out she should so than that the their them then there these they this those to up us was we were what when where which who why will with would you your kindly please user users ticket issue request help unable access provide provideed`.split(
    " ",
  ),
);

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, " ")
    .replace(/\b[a-z]{1,3}\d{3,}\b/gi, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .match(/[\p{L}]{2,30}/gu)
    ?.filter((term) => !STOP_WORDS.has(term)) ?? [];
}

function buildCorpus(): HistoricalCorpus {
  const source = readFileSync(DATA_PATH, "utf8");
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("Historical ticket dataset is empty");

  const headers = new Map(rows[0].map((header, index) => [header.trim(), index]));
  const textColumn = headers.get("clean_text");
  const titleColumn = headers.get("Title");
  const descriptionColumn = headers.get("Description");
  const categoryColumn = headers.get("Service Category");
  const resolutionColumn = headers.get("Resolution Comments");
  if (
    textColumn === undefined ||
    categoryColumn === undefined ||
    resolutionColumn === undefined
  ) {
    throw new Error("Historical ticket dataset is missing expected columns");
  }

  const termsByDocument: string[][] = [];
  const documents: HistoricalDocument[] = [];
  const categoryCounts = new Map<string, number>();
  const documentFrequency = new Map<string, number>();

  for (const row of rows.slice(1)) {
    const category = (row[categoryColumn] ?? "").trim();
    if (!category) continue;
    const text =
      row[textColumn]?.trim() ||
      `${row[titleColumn ?? -1] ?? ""} ${row[descriptionColumn ?? -1] ?? ""}`;
    const terms = tokenize(text);
    if (terms.length === 0) continue;

    const documentId = documents.length;
    termsByDocument.push(terms);
    documents.push({
      category,
      hasResolution: Boolean(row[resolutionColumn]?.trim()),
      norm: 0,
    });
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    if (documentId >= 100_000) break;
  }

  const totalDocuments = documents.length;
  const idf = new Map<string, number>();
  for (const [term, frequency] of documentFrequency) {
    idf.set(term, Math.log(1 + totalDocuments / (1 + frequency)) + 1);
  }

  const postings = new Map<string, Posting[]>();
  for (let documentId = 0; documentId < termsByDocument.length; documentId += 1) {
    const counts = new Map<string, number>();
    for (const term of termsByDocument[documentId]) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    let squaredNorm = 0;
    for (const [term, count] of counts) {
      const inverseFrequency = idf.get(term);
      if (inverseFrequency === undefined) continue;
      const weight = (1 + Math.log(count)) * inverseFrequency;
      squaredNorm += weight * weight;
      const list = postings.get(term) ?? [];
      list.push({ documentId, weight });
      postings.set(term, list);
    }
    documents[documentId].norm = Math.sqrt(squaredNorm) || 1;
  }

  return { documents, idf, postings, categoryCounts };
}

let corpus: HistoricalCorpus | null = null;
let corpusFailure: Error | null = null;
try {
  corpus = buildCorpus();
  logger.info(
    { records: corpus.documents.length, categories: corpus.categoryCounts.size },
    "Historical TF-IDF classifier ready",
  );
} catch (error) {
  corpusFailure =
    error instanceof Error ? error : new Error("Classifier initialization failed");
  logger.error({ err: corpusFailure }, "Historical classifier is unavailable");
}

export function isHistoricalClassifierReady(): boolean {
  return corpus !== null;
}

export function listHistoricalCategories(): Array<{
  name: string;
  historicalCount: number;
}> {
  if (!corpus) return [];
  return Array.from(corpus.categoryCounts, ([name, historicalCount]) => ({
    name,
    historicalCount,
  })).sort((left, right) => right.historicalCount - left.historicalCount);
}

function safeResolutionNote(category: string): string {
  return `The matching historical record is from ${category}. Its original resolution text is withheld because the source tickets may contain identifying details. Check the approved ${category} runbook and confirm the result with the requester.`;
}

export function analyzeHistoricalIncident(
  title: string,
  description: string,
  similarLimit = 3,
): HistoricalAnalysis {
  if (!corpus) {
    throw new Error(
      corpusFailure?.message ?? "Historical classifier is unavailable",
    );
  }

  const queryTerms = tokenize(`${title} ${description}`);
  const queryCounts = new Map<string, number>();
  for (const term of queryTerms) {
    queryCounts.set(term, (queryCounts.get(term) ?? 0) + 1);
  }
  const queryWeights = new Map<string, number>();
  let querySquaredNorm = 0;
  for (const [term, count] of queryCounts) {
    const inverseFrequency = corpus.idf.get(term);
    if (inverseFrequency === undefined) continue;
    const weight = (1 + Math.log(count)) * inverseFrequency;
    queryWeights.set(term, weight);
    querySquaredNorm += weight * weight;
  }
  const queryNorm = Math.sqrt(querySquaredNorm);
  if (!queryNorm) {
    return {
      predictedCategory: "Needs manual triage",
      confidence: 0,
      method: METHOD,
      rationale:
        "The report has no useful overlap with the historical ticket vocabulary, so no category is inferred.",
      similarIncidents: [],
      recommendedResolution:
        "Confirm the affected service, scope, recent changes, and business impact. Follow the approved service runbook, make no unverified or irreversible changes, and escalate if the cause or risk is unclear.",
      resolutionMethod: "Human-reviewed guidance; no LLM or automated remediation",
    };
  }

  const scores = new Map<number, number>();
  for (const [term, queryWeight] of queryWeights) {
    for (const posting of corpus.postings.get(term) ?? []) {
      scores.set(
        posting.documentId,
        (scores.get(posting.documentId) ?? 0) + queryWeight * posting.weight,
      );
    }
  }

  const ranked = Array.from(scores, ([documentId, dotProduct]) => {
    const document = corpus!.documents[documentId];
    return {
      document,
      similarity: Math.max(
        0,
        Math.min(1, dotProduct / (queryNorm * document.norm)),
      ),
    };
  })
    .filter((match) => match.similarity > 0.02)
    .sort((left, right) => right.similarity - left.similarity);

  if (ranked.length === 0) {
    return {
      predictedCategory: "Needs manual triage",
      confidence: 0,
      method: METHOD,
      rationale:
        "No sufficiently similar historical records were found; a person should assign the category.",
      similarIncidents: [],
      recommendedResolution:
        "Confirm the affected service, scope, recent changes, and business impact. Follow the approved service runbook, make no unverified or irreversible changes, and escalate if the cause or risk is unclear.",
      resolutionMethod: "Human-reviewed guidance; no LLM or automated remediation",
    };
  }

  const categoryScores = new Map<string, number>();
  for (const match of ranked.slice(0, 10)) {
    categoryScores.set(
      match.document.category,
      (categoryScores.get(match.document.category) ?? 0) + match.similarity,
    );
  }
  const bestCategory = Array.from(categoryScores).sort(
    (left, right) => right[1] - left[1],
  )[0];
  const categoryScoreTotal = Array.from(categoryScores.values()).reduce(
    (sum, score) => sum + score,
    0,
  );
  const topMatch = ranked[0];
  const categoryAgreement = bestCategory[1] / categoryScoreTotal;
  const confidence = Math.max(
    0,
    Math.min(0.99, topMatch.similarity * (0.55 + 0.45 * categoryAgreement)),
  );
  const resolvedMatches = ranked
    .filter((match) => match.document.hasResolution)
    .slice(0, Math.max(1, Math.min(5, similarLimit)))
    .map((match, index) => ({
      title: `Historical ticket match ${index + 1}`,
      category: match.document.category,
      resolution: safeResolutionNote(match.document.category),
      similarity: Number(match.similarity.toFixed(4)),
    }));

  return {
    predictedCategory: bestCategory[0],
    confidence: Number(confidence.toFixed(4)),
    method: METHOD,
    rationale: `Category is ranked from the ten closest lexical matches among ${corpus.documents.length.toLocaleString()} processed historical tickets. The similarity score is a ranking signal, not a calibrated probability.`,
    similarIncidents: resolvedMatches,
    recommendedResolution:
      `Historical retrieval found ${ranked.length.toLocaleString()} related ticket${ranked.length === 1 ? "" : "s"}; the leading category is ${bestCategory[0]}. Confirm the affected service and scope, consult its approved runbook, and use only an authorized, reversible change. Verify the result with the requester and document evidence. Escalate if impact is broad or the recommended path is uncertain. Historical text is not exposed and no action is executed automatically.`,
    resolutionMethod: "Human-reviewed guidance; no LLM or automated remediation",
  };
}

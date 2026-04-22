type Diagnostic = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
};

type UserLike = {
  id: string;
  name?: string;
};

export type MatchResult = {
  userId: string;
  name: string;
  mbti: string;
  businessCode: string;
  score: number;
};

function normalizeMbti(value?: string) {
  return (value || "").trim().toUpperCase();
}

function normalizeBusinessCode(value?: string) {
  return (value || "").trim().toUpperCase();
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function scoreMbtiPair(a: string, b: string) {
  if (!a || !b || a.length !== 4 || b.length !== 4) {
    return 0;
  }

  let score = 0;
  score += a[0] !== b[0] ? 2 : 1;
  score += a[1] === b[1] ? 3 : 0;
  score += a[2] !== b[2] ? 2 : 1;
  score += a[3] === b[3] ? 3 : 0;

  return score;
}

function scoreBusinessCodePair(a: string, b: string) {
  if (!a || !b) return 0;

  const length = Math.min(a.length, b.length);
  let score = 0;

  for (let i = 0; i < length; i += 1) {
    if (a[i] === b[i]) {
      score += 2;
    }
  }

  return score;
}

function hasEnoughDiagnosticData(diagnostic?: Diagnostic) {
  const mbti = normalizeMbti(diagnostic?.mbti);
  const businessCode = normalizeBusinessCode(diagnostic?.businessCode);
  return mbti.length === 4 && businessCode.length > 0;
}

export function calculateCompatibilityScore(a: Diagnostic, b: Diagnostic) {
  const aMbti = normalizeMbti(a.mbti);
  const bMbti = normalizeMbti(b.mbti);
  const aCode = normalizeBusinessCode(a.businessCode);
  const bCode = normalizeBusinessCode(b.businessCode);

  const mbtiScore = scoreMbtiPair(aMbti, bMbti);
  const businessScore = scoreBusinessCodePair(aCode, bCode);

  let penalty = 0;
  if (!hasEnoughDiagnosticData(a)) penalty += 4;
  if (!hasEnoughDiagnosticData(b)) penalty += 4;

  return clampScore(mbtiScore + businessScore - penalty);
}

export function buildMatchesForUser(
  baseUserId: string,
  users: UserLike[],
  diagnosticsMap: Record<string, Diagnostic>
) {
  const baseDiagnostic = diagnosticsMap[baseUserId];

  if (!baseDiagnostic || !hasEnoughDiagnosticData(baseDiagnostic)) {
    return {
      goodMatches: [] as MatchResult[],
      conflictMatches: [] as MatchResult[],
    };
  }

  const scored: MatchResult[] = users
    .filter((user) => user.id !== baseUserId)
    .map((user) => {
      const targetDiagnostic = diagnosticsMap[user.id] || {};
      const mbti = normalizeMbti(targetDiagnostic.mbti) || "-";
      const businessCode = normalizeBusinessCode(targetDiagnostic.businessCode) || "-";

      return {
        userId: user.id,
        name: user.name || "不明",
        mbti,
        businessCode,
        score: calculateCompatibilityScore(baseDiagnostic, targetDiagnostic),
      };
    });

  const sortedHigh = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, "ja");
  });

  const sortedLow = [...scored].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.name.localeCompare(b.name, "ja");
  });

  return {
    goodMatches: sortedHigh.slice(0, 3),
    conflictMatches: sortedLow.slice(0, 3),
  };
}
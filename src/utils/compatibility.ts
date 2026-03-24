type Diagnostic = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
};

type UserLike = {
  id: string;
  name?: string;
};

type MatchResult = {
  userId: string;
  name: string;
  mbti: string;
  businessCode: string;
  score: number;
};

function scoreMbti(a: string, b: string) {
  if (!a || !b || a.length !== 4 || b.length !== 4) return 0;

  let score = 0;

  // 1文字目: E/I は補完寄り
  score += a[0] !== b[0] ? 2 : 1;

  // 2文字目: S/N は一致寄り
  score += a[1] === b[1] ? 2 : 0;

  // 3文字目: T/F は補完寄り
  score += a[2] !== b[2] ? 2 : 1;

  // 4文字目: J/P は一致寄り
  score += a[3] === b[3] ? 2 : 0;

  return score;
}

function scoreBusinessCode(a: string, b: string) {
  if (!a || !b) return 0;

  const len = Math.min(a.length, b.length);
  let same = 0;

  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) same += 1;
  }

  return same;
}

export function calculateCompatibilityScore(
  a: Diagnostic,
  b: Diagnostic
) {
  const mbtiScore = scoreMbti(a.mbti || "", b.mbti || "");
  const businessScore = scoreBusinessCode(
    a.businessCode || "",
    b.businessCode || ""
  );

  return mbtiScore + businessScore;
}

export function buildMatchesForUser(
  baseUserId: string,
  users: UserLike[],
  diagnosticsMap: Record<string, Diagnostic>
) {
  const baseDiagnostic = diagnosticsMap[baseUserId];
  if (!baseDiagnostic) {
    return {
      goodMatches: [] as MatchResult[],
      conflictMatches: [] as MatchResult[],
    };
  }

  const scored: MatchResult[] = users
    .filter((u) => u.id !== baseUserId)
    .map((u) => {
      const d = diagnosticsMap[u.id] || {};
      return {
        userId: u.id,
        name: u.name || "不明",
        mbti: d.mbti || "-",
        businessCode: d.businessCode || "-",
        score: calculateCompatibilityScore(baseDiagnostic, d),
      };
    });

  const goodMatches = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const conflictMatches = [...scored]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return {
    goodMatches,
    conflictMatches,
  };
}
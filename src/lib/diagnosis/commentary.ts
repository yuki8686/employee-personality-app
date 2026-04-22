import { getPersonalityProfile } from "@/lib/diagnosis/personalityMaster";

type AxisScore = {
  leftKey?: string;
  rightKey?: string;
  leftScore?: number;
  rightScore?: number;
  leftRatio?: number;
  rightRatio?: number;
  difference?: number;
  dominant?: string;
  isBorderline?: boolean;
  neutralRate?: number;
  signedScore?: number;
};

type DiagnosticAxisMap = Record<string, AxisScore>;

type DiagnosticLike = {
  mbti?: {
    type?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: DiagnosticAxisMap;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: DiagnosticAxisMap;
  };
};

type CommentaryBlock = {
  title: string;
  body: string;
};

type CompatibilityGuide = {
  fitTitle: string;
  fitBody: string;
  cautionTitle: string;
  cautionBody: string;
  adviceTitle: string;
  adviceBody: string;
};

const AXIS_LABELS: Record<string, string> = {
  EI: "E / I",
  SN: "S / N",
  TF: "T / F",
  JP: "J / P",
  MP: "Manager / Player",
  QR: "Quest / Reward",
  VT: "Value / Terms",
  CS: "Challenge / Safety",
};

function formatAxisLabel(axis: string) {
  return AXIS_LABELS[axis] || axis;
}

function getConfidenceTone(score?: number) {
  if (typeof score !== "number") {
    return "現時点では傾向把握として読むのがよさそうです。";
  }
  if (score >= 85) {
    return "全体として回答の一貫性が高く、この結果はかなり安定しています。";
  }
  if (score >= 70) {
    return "おおむね安定した傾向が出ていますが、一部には揺れも見られます。";
  }
  if (score >= 55) {
    return "傾向は見えていますが、場面によって出方が変わる可能性があります。";
  }
  return "今回は方向感の確認として読みつつ、再受験で精度を上げる余地があります。";
}

function getAxisLeanText(axis: string, score?: AxisScore) {
  if (!score?.dominant) return null;

  const leftRatio =
    typeof score.leftRatio === "number" ? Math.round(score.leftRatio * 100) : null;
  const rightRatio =
    typeof score.rightRatio === "number" ? Math.round(score.rightRatio * 100) : null;

  const dominantRatio =
    score.dominant === score.leftKey ? leftRatio : rightRatio;

  if (score.isBorderline) {
    return `${formatAxisLabel(axis)} は ${score.dominant} 側に出ていますが、かなり境界に近い軸です。`;
  }

  if (typeof dominantRatio === "number" && dominantRatio >= 65) {
    return `${formatAxisLabel(axis)} は ${score.dominant} 側がやや強めに出ています。`;
  }

  return `${formatAxisLabel(axis)} は ${score.dominant} 側に寄っています。`;
}

function getTopAxes(axes?: DiagnosticAxisMap, count = 2) {
  if (!axes) return [];
  return Object.entries(axes)
    .sort((a, b) => {
      const aDiff = typeof a[1].difference === "number" ? a[1].difference! : -1;
      const bDiff = typeof b[1].difference === "number" ? b[1].difference! : -1;
      return bDiff - aDiff;
    })
    .slice(0, count);
}

function getWeakAxes(axes?: DiagnosticAxisMap, count = 2) {
  if (!axes) return [];
  return Object.entries(axes)
    .sort((a, b) => {
      const aDiff = typeof a[1].difference === "number" ? a[1].difference! : 999;
      const bDiff = typeof b[1].difference === "number" ? b[1].difference! : 999;
      return aDiff - bDiff;
    })
    .slice(0, count);
}

function getAmbiguityText(axes?: string[]) {
  if (!axes || axes.length === 0) {
    return "大きく揺れている軸は少なく、全体としては比較的読みやすい結果です。";
  }

  if (axes.length === 1) {
    return `${formatAxisLabel(axes[0])} に揺れがあり、場面によって見え方が変わる可能性があります。`;
  }

  return `${axes
    .map((axis) => formatAxisLabel(axis))
    .join(" / ")} に揺れがあり、状況や役割で出方が変わりやすいタイプです。`;
}

function getMbtiCoreSummary(typeCode?: string) {
  if (!typeCode || typeCode.length < 4) {
    return "MBTIの中核傾向はまだ十分に読み取れません。";
  }

  const [ei, sn, tf, jp] = typeCode.split("");

  const parts: string[] = [];

  parts.push(
    ei === "E"
      ? "人や外部との接点からエネルギーを得やすい傾向があります。"
      : "一人で整理する時間からエネルギーを回復しやすい傾向があります。"
  );

  parts.push(
    sn === "N"
      ? "目の前の事実だけでなく、可能性や発想の広がりにも目が向きやすいです。"
      : "抽象論よりも、事実や実績、現実性を土台に考えやすいです。"
  );

  parts.push(
    tf === "T"
      ? "判断では、感情だけでなく筋道や合理性を重視しやすいです。"
      : "判断では、正しさだけでなく人への影響や納得感も重視しやすいです。"
  );

  parts.push(
    jp === "J"
      ? "進め方は、見通しを持って整えてから動くほうが安定しやすいです。"
      : "進め方は、状況を見ながら柔軟に調整していくほうが力を出しやすいです。"
  );

  return parts.join(" ");
}

function getMbtiWorkHint(typeCode?: string) {
  if (!typeCode || typeCode.length < 4) {
    return "仕事上のスタイルは追加データが揃うと、さらに読みやすくなります。";
  }

  const [ei, sn, tf, jp] = typeCode.split("");

  const roleText =
    ei === "E"
      ? "人を巻き込みながら前に進める場面で持ち味が出やすいです。"
      : "一人で深く考えて質を上げる場面で持ち味が出やすいです。";

  const ideaText =
    sn === "N"
      ? "企画、構想、変化対応の場面で強みが出やすいです。"
      : "運用、改善、具体化の場面で強みが出やすいです。";

  const judgeText =
    tf === "T"
      ? "論点整理や意思決定では冷静さが武器になります。"
      : "合意形成や関係調整では配慮の深さが武器になります。";

  const paceText =
    jp === "J"
      ? "計画や優先順位が先に見えているほど安定して力を出せます。"
      : "進めながら試せる余白があるほど自然に力を出せます。";

  return `${roleText}${ideaText}${judgeText}${paceText}`;
}

function getBusinessCoreSummary(typeCode?: string) {
  const profile = getPersonalityProfile(typeCode);
  if (!profile) {
    return "Business人格の中核傾向はまだ十分に読み取れません。";
  }
  return `${profile.summary} ${profile.growthTip}`;
}

function getBusinessWorkHint(typeCode?: string, axes?: DiagnosticAxisMap) {
  const profile = getPersonalityProfile(typeCode);
  if (!profile) {
    return "役割適性は追加データが揃うと、さらに読みやすくなります。";
  }

  const mp = axes?.MP?.dominant || typeCode?.[0];
  const qr = axes?.QR?.dominant || typeCode?.[1];
  const vt = axes?.VT?.dominant || typeCode?.[2];
  const cs = axes?.CS?.dominant || typeCode?.[3];

  const roleText =
    mp === "M"
      ? "全体を見て役割や流れを整える立場で強みが出やすいです。"
      : "現場で手を動かしながら成果を形にする立場で強みが出やすいです。";

  const motiveText =
    qr === "Q"
      ? "成長実感や達成感が見えるほどアクセルがかかりやすいです。"
      : "周囲への貢献実感や期待への応答が見えるほど粘り強くなりやすいです。";

  const valueText =
    vt === "V"
      ? "意味や納得感が腹落ちしているほどパフォーマンスが伸びやすいです。"
      : "条件や現実性が整理されているほど安定して力を出しやすいです。";

  const paceText =
    cs === "C"
      ? "初動の速さや挑戦場面で違いを作りやすいです。"
      : "品質担保や安定運用の場面で信頼を積みやすいです。";

  return `${profile.name} としての基調に加えて、${roleText}${motiveText}${valueText}${paceText}`;
}

function getWeakAxisText(axes?: DiagnosticAxisMap) {
  const weakAxes = getWeakAxes(axes, 2).map(([axis]) => formatAxisLabel(axis));
  if (weakAxes.length === 0) {
    return "大きく迷いやすい軸は多くありません。";
  }
  return `${weakAxes.join(" / ")} は比較的差が小さく、相手や環境で反応が変わりやすい領域です。`;
}

function getOverallWorkView(input: DiagnosticLike) {
  const mbtiType = input.mbti?.type || "";
  const businessType = input.businessPersonality?.primaryType || "";

  const tf = mbtiType[2] || "";
  const jp = mbtiType[3] || "";
  const mp = businessType[0] || "";
  const cs = businessType[3] || "";

  const decisionText =
    tf === "T"
      ? "判断の軸は比較的ぶれにくく、論点整理や優先順位設計に強みが出やすいです。"
      : "人や場への配慮を織り込みながら進められるため、合意形成や関係調整で価値を出しやすいです。";

  const managementText =
    mp === "M"
      ? "役割としては、全体を見ながら整えるポジションで持ち味が出やすいです。"
      : "役割としては、現場で進めながら形にするポジションで持ち味が出やすいです。";

  const riskText =
    cs === "C"
      ? "一方でスピードが先行すると、周囲との準備度の差が摩擦になりやすいです。"
      : "一方で慎重さが強く出ると、機会を逃したように見られることがあります。";

  const processText =
    jp === "J"
      ? "進める時は、先に段取りや判断基準をそろえると安定しやすいです。"
      : "進める時は、余白を残しながら試せる環境のほうが自然に力を出しやすいです。";

  return `${decisionText}${managementText}${riskText}${processText}`;
}

function getPairAdviceFromMbti(mbtiType?: string) {
  const mbti = mbtiType || "";
  const jAdvice = mbti.includes("J")
    ? "計画や段取りを先に共有すると力を出しやすいです。"
    : "進めながら調整できる余白を残すと力を出しやすいです。";

  const tfAdvice = mbti.includes("T")
    ? "結論だけでなく、相手が納得しやすい言い方を添えると摩擦が減ります。"
    : "配慮に加えて、判断基準を言語化すると伝わりやすくなります。";

  const eiAdvice = mbti.includes("E")
    ? "途中経過を共有しながら進めると、連携の熱量を保ちやすいです。"
    : "考える余白を確保したうえで会話すると、質の高い反応が返りやすいです。";

  return `${jAdvice} ${tfAdvice} ${eiAdvice}`;
}

export function buildDiagnosisCommentary(diagnostic: DiagnosticLike) {
  const mbtiType = diagnostic.mbti?.type;
  const businessType = diagnostic.businessPersonality?.primaryType;
  const businessProfile = getPersonalityProfile(businessType);

  const mbtiTopAxes = getTopAxes(diagnostic.mbti?.axisResults, 2);
  const businessTopAxes = getTopAxes(diagnostic.businessPersonality?.axisResults, 2);

  const mbtiBody = [
    getMbtiCoreSummary(mbtiType),
    getMbtiWorkHint(mbtiType),
    ...mbtiTopAxes
      .map(([axis, score]) => getAxisLeanText(axis, score))
      .filter((value): value is string => Boolean(value)),
    getWeakAxisText(diagnostic.mbti?.axisResults),
    getAmbiguityText(diagnostic.mbti?.ambiguityAxes),
    getConfidenceTone(diagnostic.mbti?.confidence),
  ].join(" ");

  const businessBody = [
    getBusinessCoreSummary(businessType),
    getBusinessWorkHint(
      businessType,
      diagnostic.businessPersonality?.axisResults
    ),
    ...businessTopAxes
      .map(([axis, score]) => getAxisLeanText(axis, score))
      .filter((value): value is string => Boolean(value)),
    getWeakAxisText(diagnostic.businessPersonality?.axisResults),
    getAmbiguityText(diagnostic.businessPersonality?.ambiguityAxes),
    getConfidenceTone(diagnostic.businessPersonality?.confidence),
  ].join(" ");

  const overallParts: string[] = [];

  if (businessProfile) {
    overallParts.push(
      `${businessProfile.name} は、${businessProfile.group} の中でも ${businessProfile.summary}`
    );
  }

  if (mbtiType && businessType) {
    overallParts.push(
      `今回の結果では、MBTI ${mbtiType} の対人・思考傾向と、Business人格 ${businessType} の仕事スタイルが重なって出ています。`
    );
  }

  overallParts.push(getOverallWorkView(diagnostic));

  if (
    (diagnostic.mbti?.ambiguityAxes?.length ?? 0) > 0 ||
    (diagnostic.businessPersonality?.ambiguityAxes?.length ?? 0) > 0
  ) {
    overallParts.push(
      "ただし一部の軸は境界に近いため、役割や環境によって見え方が変わる余地があります。"
    );
  } else {
    overallParts.push(
      "全体として、日常の振る舞いと仕事上のスタイルが比較的一貫して表れている結果です。"
    );
  }

  if (businessProfile) {
    overallParts.push(`伸ばしどころは「${businessProfile.growthTip}」です。`);
  }

  const blocks: CommentaryBlock[] = [
    { title: "MBTI COMMENTARY", body: mbtiBody },
    { title: "BUSINESS COMMENTARY", body: businessBody },
    { title: "OVERALL INSIGHT", body: overallParts.join(" ") },
  ];

  return {
    businessProfile,
    blocks,
  };
}

export function buildCompatibilityGuide(diagnostic: DiagnosticLike): CompatibilityGuide {
  const businessType = diagnostic.businessPersonality?.primaryType;
  const businessProfile = getPersonalityProfile(businessType);
  const mbtiType = diagnostic.mbti?.type || "";
  const businessAxes = diagnostic.businessPersonality?.axisResults;

  if (!businessProfile) {
    return {
      fitTitle: "噛み合いやすい相手",
      fitBody: "役割や判断基準が整理されている相手とは、比較的噛み合いやすいです。",
      cautionTitle: "ぶつかりやすい相手",
      cautionBody: "主導権や判断基準が近すぎる相手とは、役割が競合しやすいです。",
      adviceTitle: "協働のコツ",
      adviceBody: "最初にゴール、役割、判断基準をそろえると協働しやすくなります。",
    };
  }

  const fitWith = businessProfile.fitWith.join(" / ");
  const cautionWith = businessProfile.cautionWith.join(" / ");

  const mp = businessAxes?.MP?.dominant || businessType?.[0];
  const cs = businessAxes?.CS?.dominant || businessType?.[3];

  const baseFit =
    mp === "M"
      ? "役割分担が明確で、全体設計を尊重できる相手"
      : "現場判断を尊重し、実行スピードを阻害しすぎない相手";

  const baseCaution =
    cs === "C"
      ? "慎重に整えたい相手とは、初動の速さで温度差が出やすいです。"
      : "まず動いて形にしたい相手とは、精度と速度の優先順位でずれやすいです。";

  return {
    fitTitle: "噛み合いやすい相手",
    fitBody: `${businessProfile.code} は ${fitWith} のように、役割や視点を補い合える相手と噛み合いやすいです。特に ${baseFit} と組むと持ち味が安定して出やすくなります。`,
    cautionTitle: "ぶつかりやすい相手",
    cautionBody: `${cautionWith} のように、主導権の取り方や重視点が近すぎる、あるいは逆方向に強すぎる相手とは摩擦が起きやすいです。${baseCaution}`,
    adviceTitle: "協働のコツ",
    adviceBody: `${businessProfile.growthTip} また、${getPairAdviceFromMbti(
      mbtiType
    )} 最初にゴール、役割、判断基準、相談タイミングをそろえると協働しやすくなります。`,
  };
}

export function buildPairCompatibilityComment(input: {
  leftBusinessType?: string;
  rightBusinessType?: string;
  leftMbtiType?: string;
  rightMbtiType?: string;
}) {
  const left = getPersonalityProfile(input.leftBusinessType);
  const right = getPersonalityProfile(input.rightBusinessType);

  if (!left || !right) {
    return "相性コメントの生成に必要なタイプ情報が不足しています。";
  }

  const sameGroup = left.group === right.group;
  const sameType = left.code === right.code;
  const bothT =
    input.leftMbtiType?.includes("T") && input.rightMbtiType?.includes("T");
  const bothJ =
    input.leftMbtiType?.includes("J") && input.rightMbtiType?.includes("J");
  const oneC =
    input.leftBusinessType?.includes("C") || input.rightBusinessType?.includes("C");
  const oneS =
    input.leftBusinessType?.includes("S") || input.rightBusinessType?.includes("S");

  if (sameType) {
    return `${left.name} 同士は判断基準が似ているため、初速は合いやすい一方で、役割が重なると主導権競合が起きやすい組み合わせです。担当範囲と最終判断者を先に分けると安定しやすいです。`;
  }

  if (sameGroup) {
    return `${left.group} 同士でテンポ感は近い一方、似た強みが重なるぶん役割分担を明確にすると安定しやすい組み合わせです。誰が前に出て、誰が支えるかを早めに決めると噛み合いやすくなります。`;
  }

  if (bothT && bothJ) {
    return `両者とも判断と推進が速くなりやすい組み合わせです。結論は出やすい一方で、配慮や確認を飛ばさないことが重要です。特に品質確認と周囲説明を意識すると強い組み合わせになります。`;
  }

  if (oneC && oneS) {
    return `${left.name} と ${right.name} は、挑戦速度と慎重さのバランスを取れると非常に強い組み合わせです。一方で「もう動くか、まだ整えるか」でぶつかりやすいため、判断期限を先に決めると安定しやすいです。`;
  }

  return `${left.name} と ${right.name} は、役割や判断基準の違いを持ち寄ることで強みが出やすい組み合わせです。最初にゴールと役割をそろえると噛み合いやすくなります。`;
}
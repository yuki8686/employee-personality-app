export type PersonalityGroup = "挑戦型" | "戦略型" | "職人型" | "調和型";

export type PersonalityProfile = {
  code: string;
  name: string;
  group: PersonalityGroup;
  summary: string;
  strengths: string[];
  cautions: string[];
  growthTip: string;
  fitWith: string[];
  cautionWith: string[];
};

export const personalityMaster: Record<string, PersonalityProfile> = {
  MQVC: {
    code: "MQVC",
    name: "最前線キャプテン",
    group: "挑戦型",
    summary:
      "先頭に立って方向を示し、迷いがある場面でも前に進める推進型リーダーです。",
    strengths: ["決断が早い", "周囲を引っ張れる", "新しい局面に強い"],
    cautions: ["細部の詰めが甘くなりやすい", "周囲の準備速度とズレやすい"],
    growthTip: "進める力に加えて、任せ方と確認の質を上げると強さが安定します。",
    fitWith: ["PRVS", "MRVS", "PQTS"],
    cautionWith: ["MQVC", "MQTS", "MRTS"],
  },
  MRVC: {
    code: "MRVC",
    name: "カリスマ監督",
    group: "挑戦型",
    summary:
      "人の力を引き出しながら全体を前に進める、統率力の高い牽引タイプです。",
    strengths: ["チームをまとめる", "期待値を合わせる", "空気を動かせる"],
    cautions: ["自分で抱え込みにくい", "現場感が薄れることがある"],
    growthTip: "現場の温度感を定期的に取りに行くと、統率力がさらに活きます。",
    fitWith: ["PQVS", "PRVS", "PRTS"],
    cautionWith: ["MQVC", "MRTC", "MQTS"],
  },
  PQVC: {
    code: "PQVC",
    name: "没入ダイバー",
    group: "挑戦型",
    summary:
      "興味や可能性のあるテーマに深く潜り、集中力で成果を出す没頭タイプです。",
    strengths: ["集中力が高い", "独自性がある", "深く掘れる"],
    cautions: ["全体共有が遅れやすい", "周囲との歩調がズレやすい"],
    growthTip: "途中共有の習慣を持つと、強い個人力がチーム成果に変わります。",
    fitWith: ["MRVC", "MRVS", "MRTS"],
    cautionWith: ["PRVC", "PQVC", "PRTC"],
  },
  PRVC: {
    code: "PRVC",
    name: "火事場のエース",
    group: "挑戦型",
    summary:
      "不確実な場面でもまず動き、現場で答えをつかむ瞬発力の高い実戦タイプです。",
    strengths: ["初動が早い", "現場対応に強い", "修正しながら進められる"],
    cautions: ["長期設計は抜けやすい", "勢いで押し切りやすい"],
    growthTip: "動く前にゴールと制約だけ確認すると、突破力が安定します。",
    fitWith: ["MQTS", "MRVS", "PQTS"],
    cautionWith: ["PQVC", "MQVC", "MQTC"],
  },

  MQTC: {
    code: "MQTC",
    name: "戦略パイロット",
    group: "戦略型",
    summary:
      "全体像と勝ち筋を見ながら、最短距離で成果に向かう設計型の戦略家です。",
    strengths: ["構造化が得意", "先読みができる", "判断がシャープ"],
    cautions: ["考えすぎて着手が遅れることがある", "熱量共有が弱くなりやすい"],
    growthTip: "早い仮説出しを意識すると、設計力と実行速度が両立します。",
    fitWith: ["PRVC", "PRVS", "MRVS"],
    cautionWith: ["MQTC", "PRTS", "PQVC"],
  },
  MRTC: {
    code: "MRTC",
    name: "勝負師マネージャー",
    group: "戦略型",
    summary:
      "成果に直結する打ち手を選び、人も資源も勝ち筋に乗せる成果統率タイプです。",
    strengths: ["成果志向が強い", "判断基準が明快", "推進力がある"],
    cautions: ["周囲がプレッシャーを感じやすい", "余白を残しにくい"],
    growthTip: "成果基準に加えて、納得形成の時間を少し持つと強くなります。",
    fitWith: ["PQVS", "PRVS", "PQTS"],
    cautionWith: ["MRTC", "MQVS", "MRTS"],
  },
  PQTC: {
    code: "PQTC",
    name: "スピードスター",
    group: "戦略型",
    summary:
      "判断と着手の速さで流れを作る、テンポ重視の高速実行タイプです。",
    strengths: ["行動が速い", "切り替えが早い", "チャンスを逃しにくい"],
    cautions: ["粗さが出やすい", "継続運用は飽きやすい"],
    growthTip: "着手前の確認項目を最小限だけ固定すると、速さが武器のまま安定します。",
    fitWith: ["MQVS", "MRVS", "MQTS"],
    cautionWith: ["PQTC", "PQVC", "MQVC"],
  },
  PRTC: {
    code: "PRTC",
    name: "勝ち筋ハンター",
    group: "戦略型",
    summary:
      "状況の中から勝てる場所を見つけ、素早く取りに行く機会捕捉タイプです。",
    strengths: ["機会発見が得意", "動く判断が早い", "現実感がある"],
    cautions: ["興味の切り替わりが早い", "腰を据えた積み上げは弱め"],
    growthTip: "追うテーマを絞ると、瞬発力がより大きな成果につながります。",
    fitWith: ["MQVS", "MRVS", "MRTS"],
    cautionWith: ["PRTC", "PQVC", "MQTC"],
  },

  MQVS: {
    code: "MQVS",
    name: "ハイクオリティ軍師",
    group: "職人型",
    summary:
      "理想や品質に妥協せず、全体設計から丁寧に強い成果物を作る完成度重視タイプです。",
    strengths: ["品質基準が高い", "設計が丁寧", "再現性を作れる"],
    cautions: ["完璧主義になりやすい", "スピード勝負は苦手"],
    growthTip: "完成度の基準を段階で分けると、強みを保ったまま進みやすくなります。",
    fitWith: ["PQTC", "PRTC", "MRVC"],
    cautionWith: ["MQVC", "PRVC", "MRTC"],
  },
  MRVS: {
    code: "MRVS",
    name: "縁の下のパイセン",
    group: "職人型",
    summary:
      "周囲の状態を見ながら支えを作り、チームの安定運転を支える信頼型です。",
    strengths: ["調整力が高い", "信頼されやすい", "摩擦を吸収できる"],
    cautions: ["自分の主張が後ろに回りやすい", "無理を抱え込みやすい"],
    growthTip: "支えるだけでなく、境界線を引く力を持つとさらに安定します。",
    fitWith: ["MQVC", "MRTC", "PRVC"],
    cautionWith: ["MRVS", "MQTS"],
  },
  PQVS: {
    code: "PQVS",
    name: "コツコツクラフター",
    group: "職人型",
    summary:
      "派手さより積み上げを大事にし、静かに精度を上げていく継続型の実務家です。",
    strengths: ["継続が得意", "丁寧に磨ける", "専門性を深めやすい"],
    cautions: ["変化には慎重", "存在感が伝わりにくい"],
    growthTip: "成果を見える形で共有すると、実力が正しく伝わりやすくなります。",
    fitWith: ["MRVC", "MRTC", "MQTC"],
    cautionWith: ["PQTC", "PRVC"],
  },
  PRVS: {
    code: "PRVS",
    name: "場回しコンシェルジュ",
    group: "職人型",
    summary:
      "現場の空気や状況を読みながら、実務をスムーズに回す実行調整タイプです。",
    strengths: ["現場調整がうまい", "実務感覚がある", "配慮と実行の両立"],
    cautions: ["長期戦略は後回しになりやすい", "断るのが苦手"],
    growthTip: "優先順位の線引きを明確にすると、調整力がさらに活きます。",
    fitWith: ["MQVC", "MQTC", "MRTC"],
    cautionWith: ["PRVS", "MQTS"],
  },

  MQTS: {
    code: "MQTS",
    name: "最後の砦",
    group: "調和型",
    summary:
      "品質と安全性を守りながら、組織の土台を崩さないよう支える安定型の守護者です。",
    strengths: ["抜け漏れを防げる", "安定運用に強い", "信頼性が高い"],
    cautions: ["変化に慎重すぎることがある", "強い推進役と摩擦が起きやすい"],
    growthTip: "守る基準と変えてよい範囲を分けると、対応力が大きく上がります。",
    fitWith: ["PQTC", "PRVC", "MRVC"],
    cautionWith: ["MQVC", "MRVS"],
  },
  MRTS: {
    code: "MRTS",
    name: "堅実プロデューサー",
    group: "調和型",
    summary:
      "周囲との整合を取りながら、無理なく成果を出す堅実運営タイプです。",
    strengths: ["安定した推進", "現実的な判断", "信頼形成が得意"],
    cautions: ["大胆な変化は起こしにくい", "強い個性には押されやすい"],
    growthTip: "変えない部分と挑戦する部分を分けると、安定感がさらに武器になります。",
    fitWith: ["PQVC", "PRTC", "MQVC"],
    cautionWith: ["MRTC", "MQVC"],
  },
  PQTS: {
    code: "PQTS",
    name: "信頼ガーディアン",
    group: "調和型",
    summary:
      "誠実さと安定感で周囲から信頼され、静かに成果を支える安心感のあるタイプです。",
    strengths: ["丁寧で安定", "長く任せやすい", "支援の質が高い"],
    cautions: ["攻めの場面では遅れやすい", "主張が見えにくい"],
    growthTip: "自分の判断基準を言葉にすると、信頼に加えて存在感も増します。",
    fitWith: ["MQVC", "MRVC", "PRVC"],
    cautionWith: ["PQTS", "PQTC"],
  },
  PRTS: {
    code: "PRTS",
    name: "タイパマスター",
    group: "調和型",
    summary:
      "無駄を嫌い、現実的で続けやすいやり方を見つける効率最適化タイプです。",
    strengths: ["効率感がある", "現実的に回せる", "ムダを見つけやすい"],
    cautions: ["意味づけより条件を優先しやすい", "熱量重視の人とズレやすい"],
    growthTip: "効率だけでなく、相手が動ける理由も添えると巻き込みやすくなります。",
    fitWith: ["MRVC", "MRTC", "MQTC"],
    cautionWith: ["MQVC", "MQVS", "PQVC"],
  },
};

export function getPersonalityProfile(typeCode?: string | null): PersonalityProfile | null {
  if (!typeCode) return null;
  return personalityMaster[typeCode] ?? null;
}
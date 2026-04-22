export type UserRole = "admin" | "manager" | "employee" | "partner";

export type UserStatus = "pending" | "active" | "disabled";

export type InvitationStatus =
  | "active"
  | "used"
  | "expired"
  | "revoked";

export type WizardStep =
  | "profile"
  | "mbti"
  | "business_personality"
  | "confirm"
  | "complete";

export type AxisResult = {
  rawScore: number;
  normalizedScore: number;
  side: string;
  confidence: number;
  isBorderline: boolean;
};

export type AppUser = {
  uid: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  role: UserRole;
  partnerCompany?: string;
  profileImageUrl?: string;
  status: UserStatus;
  inviteId?: string;
  currentWizardStep?: number;
  lastSavedQuestionGroup?: number;
  lastDiagnosedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InvitationDoc = {
  id?: string;
  token: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  issuedBy: string;
  expiresAt: string;
  usedBy: string;
  status: InvitationStatus;
  createdAt: string;
};

export type DepartmentDoc = {
  id?: string;
  name: string;
  parentDepartmentId: string | null;
  managerUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisSessionDoc = {
  userId: string;
  status: "in_progress" | "completed";
  step: WizardStep;
  mbtiAnswers: Record<string, number>;
  businessAnswers: Record<string, number>;
  savedAt: string;
};

export type DiagnosticsCurrentDoc = {
  userId: string;
  mbti: {
    type: string;
    strengths: string[];
    weaknesses: string[];
    traits: string[];
    axisResults: Record<string, AxisResult>;
  };
  businessPersonality: {
    primaryType: string;
    secondaryType: string;
    ambiguityAxes: string[];
    typeName: string;
    cluster: string;
    summary: string;
    communicationTips: string[];
    cautions: string[];
    axisResults: Record<string, AxisResult>;
  };
  diagnosedAt: string;
  availableRetakeAt: string;
  historyVersion: number;
  updatedAt: string;
};

export type CompatibilityCategory =
  | "good"
  | "complementary"
  | "challenging";

export type CompatibilityVisibleScopes = {
  admin: boolean;
  manager: boolean;
  employee: boolean;
  partner: boolean;
};

export type CompatibilityItemDoc = {
  targetUserId: string;
  score: number;
  confidence: number;
  category: CompatibilityCategory;
  categoryLabel: string;
  layerScores: {
    axisAffinity: number;
    roleComplement: number;
    riskPenalty: number;
    typeNarrativeBonus: number;
    behaviorEvidence: number;
  };
  businessTypePair: string;
  mbtiPair: string;
  clusterPair: string;
  matchedTags: string[];
  conflictFlags: string[];
  complementFlags: string[];
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
  visibleScopes: CompatibilityVisibleScopes;
  updatedAt: string;
};

export type FeedbackCategory = "structured_feedback";

export type FeedbackSectionDoc = {
  id: string;
  title: string;
  content: string;
  order: number;
  isDefault?: boolean;
};

export type FeedbackDoc = {
  id?: string;
  fromUid: string;
  fromName: string;
  fromRole: string;
  toUid: string;
  toName: string;
  toRole: string;
  departmentName: string;
  category: FeedbackCategory;
  message: string;
  sections?: FeedbackSectionDoc[];
  createdAt: string;
  updatedAt?: string;
};
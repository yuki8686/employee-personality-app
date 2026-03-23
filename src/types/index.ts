export type UserRole = "admin" | "manager" | "employee" | "partner";

export type DiagnosticResult = {
  mbti: string;
  businessCode: string;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  traits: string[];
  diagnosedAt: string;
};

export type CompatibilityPerson = {
  userId: string;
  name?: string;
  mbti: string;
  businessCode: string;
};

export type Feedback = {
  id: string;
  targetUserId: string;
  authorUserId: string;
  challenge: string;
  impression: string;
  expectation: string;
  comment: string;
  createdAt: string;
};

export type AppUser = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  profileImageUrl?: string;
};
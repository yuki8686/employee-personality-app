import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function normalizeRole(role?: string | null) {
  return (role || "").trim().toLowerCase();
}

export function isAdmin(role?: string | null) {
  return normalizeRole(role) === "admin";
}

export function isManager(role?: string | null) {
  return normalizeRole(role) === "manager";
}

export function isAdminOrManager(role?: string | null) {
  const nextRole = normalizeRole(role);
  return nextRole === "admin" || nextRole === "manager";
}

export function canViewOrgMap(role?: string | null) {
  return isAdminOrManager(role);
}

export function canSubmitFeedback(role?: string | null) {
  return isAdminOrManager(role);
}

export function canViewGoodMatches(role?: string | null) {
  return normalizeRole(role) !== "partner";
}

export function canViewConflictSection(role?: string | null) {
  return normalizeRole(role) !== "partner";
}

export function canViewConflictNames(role?: string | null) {
  const nextRole = normalizeRole(role);
  return nextRole === "admin" || nextRole === "manager";
}

export async function getUserRole(uid: string) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("ユーザー情報が存在しません");
  }

  return normalizeRole(docSnap.data().role);
}
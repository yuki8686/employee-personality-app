export type Role = "admin" | "manager" | "employee" | "partner";

export const canViewOthers = (role: Role) => {
  return role === "admin" || role === "manager";
};

export const canShowConflictNames = (role: Role) => {
  return role === "admin" || role === "manager";
};

export const canShowCompatibility = (role: Role) => {
  return role !== "partner";
};
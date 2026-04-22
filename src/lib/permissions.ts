export type AppRole = "admin" | "manager" | "employee" | "partner";
export type AppStatus = "pending" | "active" | "disabled";

export type PermissionUser = {
  uid: string;
  name?: string;
  email?: string;
  departmentId?: string;
  departmentName?: string;
  role?: AppRole | string;
  status?: AppStatus | string;
};

function normalizeRole(role?: string): AppRole | "" {
  const value = (role || "").toLowerCase();
  if (
    value === "admin" ||
    value === "manager" ||
    value === "employee" ||
    value === "partner"
  ) {
    return value;
  }
  return "";
}

function normalizeStatus(status?: string): AppStatus | "" {
  const value = (status || "").toLowerCase();
  if (value === "pending" || value === "active" || value === "disabled") {
    return value;
  }
  return "";
}

function safe(value?: string) {
  return (value || "").trim().toLowerCase();
}

function isSameDepartment(
  currentUser: PermissionUser,
  targetUser: PermissionUser
): boolean {
  const currentDepartmentId = safe(currentUser.departmentId);
  const targetDepartmentId = safe(targetUser.departmentId);

  if (currentDepartmentId && targetDepartmentId) {
    return currentDepartmentId === targetDepartmentId;
  }

  const currentDepartmentName = safe(currentUser.departmentName);
  const targetDepartmentName = safe(targetUser.departmentName);

  if (currentDepartmentName && targetDepartmentName) {
    return currentDepartmentName === targetDepartmentName;
  }

  return false;
}

export async function canViewUserProfile(params: {
  currentUser: PermissionUser;
  targetUser: PermissionUser;
}): Promise<boolean> {
  const { currentUser, targetUser } = params;

  const currentRole = normalizeRole(currentUser.role);
  const targetRole = normalizeRole(targetUser.role);
  const currentStatus = normalizeStatus(currentUser.status);
  const targetStatus = normalizeStatus(targetUser.status);

  if (!currentUser.uid || !targetUser.uid) {
    return false;
  }

  if (currentStatus === "disabled") {
    return false;
  }

  if (targetStatus === "disabled") {
    return false;
  }

  if (currentUser.uid === targetUser.uid) {
    return true;
  }

  if (currentRole === "admin") {
    return true;
  }

  if (currentRole === "partner") {
    return false;
  }

  if (currentRole === "employee") {
    return false;
  }

  if (currentRole === "manager") {
    if (targetRole === "admin") {
      return false;
    }

    if (targetRole === "manager") {
      return isSameDepartment(currentUser, targetUser);
    }

    if (targetRole === "employee" || targetRole === "partner" || targetRole === "") {
      return isSameDepartment(currentUser, targetUser);
    }

    return false;
  }

  return false;
}

export function canViewUserBasicInfo(params: {
  currentUser: PermissionUser;
  targetUser: PermissionUser;
}): boolean {
  const { currentUser, targetUser } = params;

  const currentRole = normalizeRole(currentUser.role);

  if (!currentUser.uid || !targetUser.uid) {
    return false;
  }

  if (currentUser.uid === targetUser.uid) {
    return true;
  }

  if (currentRole === "admin") {
    return true;
  }

  if (currentRole === "manager") {
    return isSameDepartment(currentUser, targetUser);
  }

  return false;
}
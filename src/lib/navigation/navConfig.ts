export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: string;
  exact?: boolean;
};

type NormalizedRole = "admin" | "manager" | "employee" | "partner" | "";

function normalizeRole(value?: string): NormalizedRole {
  const normalized = (value || "").trim().toLowerCase();

  if (
    normalized === "admin" ||
    normalized === "manager" ||
    normalized === "employee" ||
    normalized === "partner"
  ) {
    return normalized;
  }

  return "";
}

export function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

const HOME_ITEM: AppNavItem = {
  href: "/home",
  label: "ホーム",
  shortLabel: "ホーム",
  icon: "⌂",
  exact: true,
};

const PROFILE_ITEM: AppNavItem = {
  href: "/profile",
  label: "プロフィール",
  shortLabel: "プロフ",
  icon: "◈",
  exact: false,
};

const RESULT_ITEM: AppNavItem = {
  href: "/diagnosis/result",
  label: "診断結果",
  shortLabel: "結果",
  icon: "◉",
  exact: false,
};

const HISTORY_ITEM: AppNavItem = {
  href: "/history",
  label: "診断履歴",
  shortLabel: "履歴",
  icon: "▣",
  exact: false,
};

const FEEDBACK_ITEM: AppNavItem = {
  href: "/feedback",
  label: "フィードバック",
  shortLabel: "FB",
  icon: "✎",
  exact: false,
};

const ORG_MAP_ITEM: AppNavItem = {
  href: "/org-map",
  label: "組織マップ",
  shortLabel: "組織",
  icon: "◎",
  exact: false,
};

function getCommonPageItems(): AppNavItem[] {
  return [HOME_ITEM, PROFILE_ITEM, RESULT_ITEM, HISTORY_ITEM];
}

function getAdminManagerExtras(): AppNavItem[] {
  return [FEEDBACK_ITEM, ORG_MAP_ITEM];
}

function getEmployeeExtras(): AppNavItem[] {
  return [ORG_MAP_ITEM];
}

export function getPageNavItems(role?: string): AppNavItem[] {
  const normalizedRole = normalizeRole(role);
  const common = getCommonPageItems();

  if (normalizedRole === "admin" || normalizedRole === "manager") {
    return [...common, ...getAdminManagerExtras()];
  }

  if (normalizedRole === "employee") {
    return [...common, ...getEmployeeExtras()];
  }

  if (normalizedRole === "partner") {
    return common;
  }

  return common;
}

export function getBottomNavItems(role?: string): AppNavItem[] {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "admin" || normalizedRole === "manager") {
    return [HOME_ITEM, PROFILE_ITEM, FEEDBACK_ITEM, ORG_MAP_ITEM];
  }

  if (normalizedRole === "employee") {
    return [HOME_ITEM, PROFILE_ITEM, HISTORY_ITEM, ORG_MAP_ITEM];
  }

  if (normalizedRole === "partner") {
    return [HOME_ITEM, PROFILE_ITEM, RESULT_ITEM, HISTORY_ITEM];
  }

  return [HOME_ITEM, PROFILE_ITEM, RESULT_ITEM, HISTORY_ITEM];
}
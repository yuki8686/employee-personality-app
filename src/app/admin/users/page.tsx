"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: string;
  departmentId?: string;
  departmentName?: string;
  status?: string;
  partnerCompany?: string;
};

type EditableStatus = "active" | "pending" | "disabled";
type EditableRole = "admin" | "manager" | "employee" | "partner";

type UserRow = {
  uid: string;
  name: string;
  nameKana: string;
  email: string;
  role: EditableRole;
  departmentName: string;
  status: EditableStatus;
  partnerCompany: string;
};

function normalizeRole(value: unknown): EditableRole {
  const role = typeof value === "string" ? value.toLowerCase() : "";
  if (
    role === "admin" ||
    role === "manager" ||
    role === "employee" ||
    role === "partner"
  ) {
    return role;
  }
  return "employee";
}

function normalizeStatus(value: unknown): EditableStatus {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (status === "active" || status === "pending" || status === "disabled") {
    return status;
  }
  return "pending";
}

function normalizeRoleForNav(value?: string) {
  return (value || "").trim().toLowerCase();
}

function roleLabel(role: EditableRole) {
  if (role === "admin") return "admin / 管理者";
  if (role === "manager") return "manager / マネージャー";
  if (role === "partner") return "partner / パートナー";
  return "employee / 社員";
}

function statusLabel(status: EditableStatus) {
  if (status === "active") return "active / 有効";
  if (status === "disabled") return "disabled / 無効";
  return "pending / 保留";
}

function roleBadgeClass(role: EditableRole) {
  if (role === "admin") return "bg-[#f3c400] text-black";
  if (role === "manager") return "bg-[#d9f7ff] text-black";
  if (role === "partner") return "bg-[#ffd0d0] text-black";
  return "bg-white text-black";
}

function statusBadgeClass(status: EditableStatus) {
  if (status === "active") return "bg-[#fff27a] text-black";
  if (status === "disabled") return "bg-[#ffb4b4] text-black";
  return "bg-[#d9f7ff] text-black";
}

function PanelFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] border-[3px] border-black bg-[#171717] shadow-[0_7px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_10px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-2 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3 w-3 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-3.5 pt-5 md:p-5 md:pt-7">
        {title && (
          <div className="mb-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:tracking-[0.08em] md:shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {label}
      </p>
      <div className="mt-1.5 md:mt-2">{value}</div>
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | EditableRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EditableStatus>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const meSnap = await getDoc(doc(db, "users", user.uid));
        if (!meSnap.exists()) {
          router.push("/login");
          return;
        }

        const meData = meSnap.data() as Omit<UserProfile, "uid">;
        const me: UserProfile = {
          ...meData,
          uid: user.uid,
        };

        if ((me.role || "").toLowerCase() !== "admin") {
          router.push("/home");
          return;
        }

        setCurrentUser(me);

        const usersSnap = await getDocs(collection(db, "users"));
        const rows: UserRow[] = usersSnap.docs
          .map((item) => {
            const data = item.data() as Omit<UserProfile, "uid">;
            return {
              uid: item.id,
              name: data.name || "名称未設定",
              nameKana: data.nameKana || "",
              email: data.email || "-",
              role: normalizeRole(data.role),
              departmentName: data.departmentName || "-",
              status: normalizeStatus(data.status),
              partnerCompany: data.partnerCompany || "",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));

        setUsers(rows);
      } catch (e) {
        console.error("admin/users 読み込み失敗:", e);
        setError("ユーザー情報の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const normalizedCurrentRole = normalizeRoleForNav(currentUser?.role);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesKeyword =
        keyword === "" ||
        user.name.toLowerCase().includes(keyword) ||
        user.nameKana.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.departmentName.toLowerCase().includes(keyword) ||
        user.uid.toLowerCase().includes(keyword);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesKeyword && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      pending: users.filter((u) => u.status === "pending").length,
      disabled: users.filter((u) => u.status === "disabled").length,
    };
  }, [users]);

  const handleLocalChange = (
    uid: string,
    field: "role" | "status",
    value: string
  ) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.uid === uid
          ? {
              ...user,
              [field]:
                field === "role"
                  ? normalizeRole(value)
                  : normalizeStatus(value),
            }
          : user
      )
    );
  };

  const handleSave = async (user: UserRow) => {
    try {
      setSavingUid(user.uid);
      await updateDoc(doc(db, "users", user.uid), {
        role: user.role,
        status: user.status,
      });
    } catch (e) {
      console.error("ユーザー更新失敗:", e);
      alert("更新に失敗しました。");
    } finally {
      setSavingUid("");
    }
  };

  if (loading) {
    return (
      <P4LoadingScreen
        title="ADMIN USERS LOADING"
        subtitle="ユーザー一覧と管理情報を読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-4 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  ADMIN USERS
                </div>
                <h1 className="mt-3 text-[26px] font-black leading-tight md:mt-4 md:text-4xl">
                  ユーザー管理
                </h1>
                <p className="mt-2 max-w-3xl text-[13px] font-bold leading-6 text-white/80 md:text-sm md:leading-normal">
                  アカウントのロールとステータスを管理します。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedCurrentRole} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:gap-4 md:grid-cols-4">
              <StatCard
                label="全ユーザー数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {stats.total}
                  </p>
                }
              />
              <StatCard
                label="active"
                value={
                  <>
                    <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                      {stats.active}
                    </p>
                    <p className="mt-1 text-[11px] font-black leading-5 text-white/60 md:text-xs">
                      有効
                    </p>
                  </>
                }
              />
              <StatCard
                label="pending"
                value={
                  <>
                    <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                      {stats.pending}
                    </p>
                    <p className="mt-1 text-[11px] font-black leading-5 text-white/60 md:text-xs">
                      保留
                    </p>
                  </>
                }
              />
              <StatCard
                label="disabled"
                value={
                  <>
                    <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                      {stats.disabled}
                    </p>
                    <p className="mt-1 text-[11px] font-black leading-5 text-white/60 md:text-xs">
                      無効
                    </p>
                  </>
                }
              />
            </div>

            <div className="mt-4 grid gap-3 md:mt-5 md:gap-4 md:grid-cols-3">
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  検索
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="名前 / フリガナ / メール / 部署 / UID"
                  className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none placeholder:text-white/35 md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                />
              </div>

              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  ロール
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as "all" | EditableRole)
                  }
                  className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="employee">employee</option>
                  <option value="partner">partner</option>
                </select>
              </div>

              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  ステータス
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | EditableStatus)
                  }
                  className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="active">active</option>
                  <option value="pending">pending</option>
                  <option value="disabled">disabled</option>
                </select>
              </div>
            </div>
          </PanelFrame>

          {error && (
            <div className="rounded-[20px] border-[4px] border-black bg-[#ffd0d0] px-4 py-4 text-[13px] font-black leading-6 text-[#7b1111] shadow-[0_6px_0_#000] md:rounded-[24px] md:text-base md:shadow-[0_8px_0_#000]">
              {error}
            </div>
          )}

          <PanelFrame title="ユーザー一覧">
            <div className="mb-3 flex items-start justify-between gap-3 md:mb-4 md:items-center">
              <h2 className="text-xl font-black leading-tight md:text-2xl">
                ユーザー一覧
              </h2>
              <div className="shrink-0 rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                表示件数 {filteredUsers.length}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                  条件に一致するユーザーがいません。
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-lg font-black leading-tight md:text-xl">
                              {user.name}
                            </p>
                            {user.nameKana && (
                              <p className="mt-1 text-[13px] font-black tracking-[0.06em] text-[#ffe46a] md:text-sm md:tracking-[0.08em]">
                                {user.nameKana}
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full border-[3px] border-black px-2 py-1 text-[10px] font-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000] ${roleBadgeClass(
                              user.role
                            )}`}
                          >
                            {roleLabel(user.role)}
                          </span>

                          <span
                            className={`rounded-full border-[3px] border-black px-2 py-1 text-[10px] font-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000] ${statusBadgeClass(
                              user.status
                            )}`}
                          >
                            {statusLabel(user.status)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-1.5 text-[13px] font-bold leading-6 text-white/80 md:grid-cols-2 md:gap-2 md:text-sm md:leading-normal">
                          <p className="break-all">メール: {user.email || "-"}</p>
                          <p>部署: {user.departmentName || "-"}</p>
                          <p className="break-all">UID: {user.uid}</p>
                          <p>パートナー会社: {user.partnerCompany || "-"}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[160px_160px_120px]">
                        <div>
                          <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                            ロール
                          </label>
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleLocalChange(user.uid, "role", e.target.value)
                            }
                            className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3 py-2.5 text-[13px] font-black text-white outline-none md:rounded-[14px] md:py-3 md:text-sm"
                          >
                            <option value="admin">admin</option>
                            <option value="manager">manager</option>
                            <option value="employee">employee</option>
                            <option value="partner">partner</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                            ステータス
                          </label>
                          <select
                            value={user.status}
                            onChange={(e) =>
                              handleLocalChange(user.uid, "status", e.target.value)
                            }
                            className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3 py-2.5 text-[13px] font-black text-white outline-none md:rounded-[14px] md:py-3 md:text-sm"
                          >
                            <option value="active">active</option>
                            <option value="pending">pending</option>
                            <option value="disabled">disabled</option>
                          </select>
                          <p className="mt-1.5 text-[10px] font-bold leading-5 text-white/55 md:mt-2 md:text-[11px]">
                            active=有効 / pending=保留 / disabled=無効
                          </p>
                        </div>

                        <div>
                          <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                            更新
                          </label>
                          <button
                            type="button"
                            onClick={() => handleSave(user)}
                            disabled={savingUid === user.uid}
                            className={`mt-2 inline-flex w-full items-center justify-center rounded-[14px] border-[3px] border-black px-3 py-2.5 text-[13px] font-black transition-all duration-200 md:rounded-[16px] md:py-3 md:text-sm ${
                              savingUid === user.uid
                                ? "cursor-not-allowed bg-[#777] text-white opacity-70"
                                : "bg-[#f3c400] text-black hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000]"
                            }`}
                          >
                            {savingUid === user.uid ? "保存中..." : "更新"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelFrame>

          <PanelFrame title="管理メモ">
            <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                  操作メモ
                </p>
                <ul className="mt-2.5 list-disc pl-5 text-[13px] font-bold leading-6 text-white/85 md:mt-3 md:text-sm md:leading-7">
                  <li>ロール と ステータス を変更したあと、各ユーザーごとに更新を押してください。</li>
                  <li>検索は 名前 / フリガナ / メール / 部署 / UID に対応しています。</li>
                  <li>ステータスは active / pending / disabled を基準に管理します。</li>
                </ul>
              </div>

              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                  現在の管理者
                </p>
                <div className="mt-2.5 grid gap-1.5 text-[13px] font-bold leading-6 text-white/85 md:mt-3 md:gap-2 md:text-sm md:leading-normal">
                  <p>名前: {currentUser?.name || "-"}</p>
                  {currentUser?.nameKana && (
                    <p className="text-[#ffe46a]">フリガナ: {currentUser.nameKana}</p>
                  )}
                  <p>メール: {currentUser?.email || "-"}</p>
                  <p>ロール: {currentUser?.role || "-"}</p>
                  <p className="break-all">UID: {currentUser?.uid || "-"}</p>
                </div>
              </div>
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={normalizedCurrentRole} />
    </>
  );
}
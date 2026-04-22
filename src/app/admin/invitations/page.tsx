"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
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
};

type InvitationStatus = "active" | "used" | "expired";
type InvitationRole = "employee" | "manager" | "partner" | "admin";

type InvitationItem = {
  id: string;
  code: string;
  role: InvitationRole;
  departmentName: string;
  status: InvitationStatus;
  createdAt: string;
  usedBy: string;
};

function normalizeRoleForNav(value?: string) {
  return (value || "").trim().toLowerCase();
}

function normalizeInvitationRole(value: unknown): InvitationRole {
  const role = typeof value === "string" ? value.toLowerCase() : "";
  if (
    role === "employee" ||
    role === "manager" ||
    role === "partner" ||
    role === "admin"
  ) {
    return role;
  }
  return "employee";
}

function formatDate(value: unknown): string {
  if (!value) return "-";

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate().toLocaleString("ja-JP");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in (value as Record<string, unknown>)
  ) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toLocaleString("ja-JP");
    }
  }

  return "-";
}

function makeInviteCode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
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
      className={`relative overflow-hidden rounded-[24px] border-[3px] border-black bg-[#171717] shadow-[0_8px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_14px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-2.5 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3.5 w-3.5 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-4 pt-6 md:p-7 md:pt-9">
        {title && (
          <div className="mb-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:mb-5 md:px-4 md:py-1.5 md:text-sm md:tracking-[0.08em] md:shadow-[0_5px_0_#000]">
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
    <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[22px] md:p-6 md:shadow-[0_10px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-[13px] md:tracking-[0.15em]">
        {label}
      </p>
      <div className="mt-2 md:mt-3">{value}</div>
    </div>
  );
}

function statusBadgeClass(status: InvitationStatus) {
  if (status === "active") return "bg-[#fff27a] text-black";
  if (status === "used") return "bg-[#d9f7ff] text-black";
  return "bg-[#ffb4b4] text-black";
}

function statusLabel(status: InvitationStatus) {
  if (status === "active") return "有効";
  if (status === "used") return "使用済み";
  return "期限切れ";
}

function roleLabel(role: InvitationRole) {
  if (role === "employee") return "社員";
  if (role === "manager") return "マネージャー";
  if (role === "partner") return "パートナー";
  return "管理者";
}

export default function AdminInvitationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [role, setRole] = useState<InvitationRole>("employee");
  const [departmentName, setDepartmentName] = useState("");

  const loadInvitations = async () => {
    const snap = await getDocs(
      query(collection(db, "invitations"), orderBy("createdAt", "desc"))
    );

    const nextItems: InvitationItem[] = snap.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;

      return {
        id: item.id,
        code: typeof data.code === "string" ? data.code : item.id,
        role: normalizeInvitationRole(data.role),
        departmentName:
          typeof data.departmentName === "string" ? data.departmentName : "-",
        status:
          data.status === "active" || data.status === "used" || data.status === "expired"
            ? data.status
            : "active",
        createdAt: formatDate(data.createdAt),
        usedBy: typeof data.usedBy === "string" ? data.usedBy : "",
      };
    });

    setItems(nextItems);
  };

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
        await loadInvitations();
      } catch (e) {
        console.error("admin/invitations 読み込み失敗:", e);
        setError("招待リンク情報の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const normalizedCurrentRole = normalizeRoleForNav(currentUser?.role);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      used: items.filter((item) => item.status === "used").length,
      expired: items.filter((item) => item.status === "expired").length,
    };
  }, [items]);

  const isDepartmentRequired = role !== "admin";

  const handleCreate = async () => {
    setError("");
    setNotice("");

    const trimmedDepartmentName = departmentName.trim();

    if (isDepartmentRequired && !trimmedDepartmentName) {
      setError("管理者以外の招待リンクでは部署名を入力してください。");
      return;
    }

    try {
      setCreating(true);

      await addDoc(collection(db, "invitations"), {
        code: makeInviteCode(),
        role,
        departmentName: trimmedDepartmentName,
        status: "active",
        usedBy: "",
        createdAt: serverTimestamp(),
      });

      setDepartmentName("");
      setNotice("招待リンクを発行しました。");
      await loadInvitations();
    } catch (e) {
      console.error("招待リンク作成失敗:", e);
      setError("招待リンクの作成に失敗しました。");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("この招待リンクを削除しますか？");
    if (!ok) return;

    setError("");
    setNotice("");

    try {
      setDeletingId(id);
      await deleteDoc(doc(db, "invitations", id));
      setNotice("招待リンクを削除しました。");
      await loadInvitations();
    } catch (e) {
      console.error("招待リンク削除失敗:", e);
      setError("削除に失敗しました。");
    } finally {
      setDeletingId("");
    }
  };

  const handleCopy = async (code: string) => {
    setError("");
    setNotice("");

    try {
      await navigator.clipboard.writeText(code);
      setNotice("招待コードをコピーしました。");
    } catch (e) {
      console.error("コピー失敗:", e);
      setError("コピーに失敗しました。");
    }
  };

  if (loading) {
    return (
      <P4LoadingScreen
        title="ADMIN INVITATIONS LOADING"
        subtitle="招待リンク管理データを読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-4 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  ADMIN INVITATIONS
                </div>
                <h1 className="mt-3 text-[26px] font-black leading-tight md:mt-4 md:text-4xl">
                  招待リンク管理
                </h1>
                <p className="mt-2 max-w-3xl text-[13px] font-bold leading-6 text-white/80 md:text-sm md:leading-normal">
                  招待コードの発行、確認、削除を行います。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedCurrentRole} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:gap-4 md:grid-cols-4">
              <StatCard
                label="招待リンク数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {stats.total}
                  </p>
                }
              />
              <StatCard
                label="有効"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {stats.active}
                  </p>
                }
              />
              <StatCard
                label="使用済み"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {stats.used}
                  </p>
                }
              />
              <StatCard
                label="期限切れ"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {stats.expired}
                  </p>
                }
              />
            </div>
          </PanelFrame>

          {error && (
            <div className="rounded-[20px] border-[4px] border-black bg-[#ffd0d0] px-4 py-4 text-[13px] font-black leading-6 text-[#7b1111] shadow-[0_6px_0_#000] md:rounded-[24px] md:text-base md:shadow-[0_8px_0_#000]">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-[20px] border-[4px] border-black bg-[#fff27a] px-4 py-4 text-[13px] font-black leading-6 text-black shadow-[0_6px_0_#000] md:rounded-[24px] md:text-base md:shadow-[0_8px_0_#000]">
              {notice}
            </div>
          )}

          <PanelFrame title="新規招待リンク発行">
            <h2 className="text-xl font-black leading-tight md:text-2xl">
              新規招待リンク発行
            </h2>

            <div className="mt-4 grid gap-3 md:mt-5 md:gap-4 lg:grid-cols-[220px_1fr_auto]">
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  ロール
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(normalizeInvitationRole(e.target.value))}
                  className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-black text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                >
                  <option value="employee">社員</option>
                  <option value="manager">マネージャー</option>
                  <option value="partner">パートナー</option>
                  <option value="admin">管理者</option>
                </select>
              </div>

              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  部署名
                </label>
                <input
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder={
                    isDepartmentRequired
                      ? "例: 営業部"
                      : "管理者招待では未入力でも可"
                  }
                  className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none placeholder:text-white/35 md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                />
                <p className="mt-1.5 text-[10px] font-bold leading-5 text-white/50 md:mt-2 md:text-xs">
                  {isDepartmentRequired
                    ? "社員 / マネージャー / パートナー は部署名を設定してください。"
                    : "管理者の場合は部署名なしでも発行できます。"}
                </p>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className={`w-full rounded-[14px] border-[3px] border-black px-4 py-2.5 text-[13px] font-black transition-all duration-200 md:rounded-[16px] md:px-5 md:py-3 md:text-sm ${
                    creating
                      ? "cursor-not-allowed bg-[#777] text-white opacity-70"
                      : "bg-[#f3c400] text-black hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000]"
                  }`}
                >
                  {creating ? "作成中..." : "発行"}
                </button>
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="招待リンク一覧">
            <div className="mb-3 flex items-start justify-between gap-3 md:mb-4 md:items-center">
              <h2 className="text-xl font-black leading-tight md:text-2xl">
                招待リンク一覧
              </h2>
              <div className="shrink-0 rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                表示件数 {items.length}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                  招待リンクがまだありません。
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-all text-lg font-black leading-tight md:text-xl">
                            {item.code}
                          </p>
                          <span className="rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                            {roleLabel(item.role)}
                          </span>
                          <span
                            className={`rounded-full border-[3px] border-black px-2.5 py-1 text-[10px] font-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000] ${statusBadgeClass(
                              item.status
                            )}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-1.5 text-[13px] font-bold leading-6 text-white/80 md:grid-cols-2 md:gap-2 md:text-sm md:leading-normal">
                          <p>部署: {item.departmentName || "-"}</p>
                          <p>作成日時: {item.createdAt}</p>
                          <p className="break-all">使用者: {item.usedBy || "-"}</p>
                          <p className="break-all">ドキュメントID: {item.id}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.code)}
                          className="rounded-[14px] border-[3px] border-black bg-[#f3c400] px-3.5 py-2 text-[13px] font-black text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] md:rounded-[16px] md:px-4 md:text-sm"
                        >
                          コピー
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className={`rounded-[14px] border-[3px] border-black px-3.5 py-2 text-[13px] font-black transition-all duration-200 md:rounded-[16px] md:px-4 md:text-sm ${
                            deletingId === item.id
                              ? "cursor-not-allowed bg-[#777] text-white opacity-70"
                              : "bg-[#111111] text-white hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000]"
                          }`}
                        >
                          {deletingId === item.id ? "削除中..." : "削除"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelFrame>

          <PanelFrame title="管理メモ">
            <div className="grid gap-1.5 text-[13px] font-bold leading-6 text-white/80 md:gap-2 md:text-sm md:leading-7">
              <p>
                招待リンクはロールと部署情報を持ったまま発行されます。利用後はステータスが切り替わる想定です。
              </p>
              <p>管理者: {currentUser?.name || "-"}</p>
              {currentUser?.nameKana && (
                <p className="text-[#ffe46a]">フリガナ: {currentUser.nameKana}</p>
              )}
              <p>メール: {currentUser?.email || "-"}</p>
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={normalizedCurrentRole} />
    </>
  );
}
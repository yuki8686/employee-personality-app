"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createInvitation, revokeInvitation } from "@/lib/invitations";
import type { DepartmentDoc, InvitationDoc, UserRole } from "@/types/firestore";

type FirestoreTimestampLike = {
  seconds: number;
  nanoseconds: number;
};

type InvitationRow = {
  id: string;
  token: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  issuedBy: string;
  expiresAt: string | FirestoreTimestampLike | null;
  usedBy: string;
  status: string;
  createdAt: string | FirestoreTimestampLike | null;
};

const ROLE_OPTIONS: UserRole[] = ["admin", "manager", "employee", "partner"];

function isTimestampLike(value: unknown): value is FirestoreTimestampLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.seconds === "number" &&
    typeof candidate.nanoseconds === "number"
  );
}

function normalizeDateValue(
  value: unknown
): string | FirestoreTimestampLike | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Timestamp) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (isTimestampLike(value)) {
    return value;
  }

  return null;
}

function formatDate(
  value?: string | FirestoreTimestampLike | null
): string {
  if (!value) return "-";

  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ja-JP");
  }

  if (isTimestampLike(value)) {
    const date = new Date(value.seconds * 1000);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ja-JP");
  }

  return "-";
}

function buildInviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/register/${token}`;
}

export default function AdminInvitationsPage() {
  const [role, setRole] = useState<UserRole>("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentDoc[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedToken, setCopiedToken] = useState("");

  const selectedDepartment = useMemo(() => {
    return departments.find((d) => d.id === departmentId) ?? null;
  }, [departments, departmentId]);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const [departmentSnap, invitationSnap] = await Promise.all([
        getDocs(query(collection(db, "departments"))),
        getDocs(
          query(collection(db, "invitations"), orderBy("createdAt", "desc"))
        ),
      ]);

      const nextDepartments: DepartmentDoc[] = departmentSnap.docs.map(
        (docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DepartmentDoc, "id">),
        })
      );

      const nextInvitations: InvitationRow[] = invitationSnap.docs.map(
        (docSnap) => {
          const raw = docSnap.data() as Omit<InvitationDoc, "id"> & {
            expiresAt?: unknown;
            createdAt?: unknown;
          };

          return {
            id: docSnap.id,
            token: typeof raw.token === "string" ? raw.token : "",
            role:
              raw.role === "admin" ||
              raw.role === "manager" ||
              raw.role === "employee" ||
              raw.role === "partner"
                ? raw.role
                : "employee",
            departmentId:
              typeof raw.departmentId === "string" ? raw.departmentId : "",
            departmentName:
              typeof raw.departmentName === "string" ? raw.departmentName : "",
            issuedBy: typeof raw.issuedBy === "string" ? raw.issuedBy : "",
            expiresAt: normalizeDateValue(raw.expiresAt),
            usedBy: typeof raw.usedBy === "string" ? raw.usedBy : "",
            status: typeof raw.status === "string" ? raw.status : "",
            createdAt: normalizeDateValue(raw.createdAt),
          };
        }
      );

      setDepartments(nextDepartments);
      setInvitations(nextInvitations);

      if (!departmentId && nextDepartments.length > 0) {
        setDepartmentId(nextDepartments[0].id || "");
      }
    } catch (e) {
      console.error(e);
      setPageError("招待リンク管理画面の読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleCreateInvitation = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setPageError("ログイン状態を確認できません。再ログインしてください。");
      return;
    }

    if (!selectedDepartment) {
      setPageError("部署を選択してください。");
      return;
    }

    try {
      setSubmitting(true);
      setPageError("");
      setSuccessMessage("");
      setCopiedToken("");

      const created = await createInvitation({
        role,
        departmentId: selectedDepartment.id || "",
        departmentName: selectedDepartment.name,
        issuedBy: currentUser.uid,
      });

      const inviteUrl = buildInviteUrl(created.token);

      setSuccessMessage(
        inviteUrl
          ? `招待リンクを発行しました: ${inviteUrl}`
          : "招待リンクを発行しました。"
      );

      await loadPageData();
    } catch (e) {
      console.error(e);
      setPageError("招待リンクの発行に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (invitationId: string, status: string) => {
    if (status !== "active") return;

    try {
      setPageError("");
      await revokeInvitation(invitationId);
      await loadPageData();
    } catch (e) {
      console.error(e);
      setPageError("招待リンクの無効化に失敗しました。");
    }
  };

  const handleCopy = async (token: string) => {
    const url = buildInviteUrl(token);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
    } catch (e) {
      console.error(e);
      setPageError("クリップボードへのコピーに失敗しました。");
    }
  };

  return (
    <main className="p4g-shell min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="p4g-card overflow-hidden">
          <div className="border-b-[3px] border-black bg-[linear-gradient(90deg,#111111_0%,#1a1a1a_100%)] px-5 py-4 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="p4g-brand-ribbon">
                  <span>Regal Cast Database</span>
                </div>
                <p className="mt-4 text-xs font-black tracking-[0.18em] text-white/80">
                  ADMIN INVITATIONS
                </p>
                <h1 className="mt-1 text-3xl font-black text-white">
                  招待リンク管理
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/home" className="p4g-button p4g-button-gold">
                  HOME
                </Link>
                <Link href="/admin/users" className="p4g-button p4g-button-dark">
                  ユーザー管理
                </Link>
                <Link
                  href="/admin/diagnosis-master"
                  className="p4g-button p4g-button-dark"
                >
                  診断マスタ
                </Link>
                <Link
                  href="/admin/compatibilities"
                  className="p4g-button p4g-button-dark"
                >
                  相性再生成
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-3 md:p-5">
            <div>
              <label className="p4g-label">role</label>
              <select
                className="p4g-select"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="p4g-label">部署</label>
              <select
                className="p4g-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreateInvitation}
                disabled={submitting || loading || !selectedDepartment}
                className="p4g-button p4g-button-gold w-full disabled:opacity-50"
              >
                {submitting ? "発行中..." : "招待リンクを発行"}
              </button>
            </div>
          </div>

          {(pageError || successMessage) && (
            <div className="px-4 pb-4 md:px-5 md:pb-5">
              {pageError && (
                <p className="rounded-[18px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-sm font-black text-[#7b1111]">
                  {pageError}
                </p>
              )}

              {successMessage && (
                <p className="rounded-[18px] border-[3px] border-black bg-[#d8ffd7] px-4 py-3 text-sm font-black text-[#104e14]">
                  {successMessage}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="p4g-card p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="p4g-section-title">招待一覧</div>
            <button
              type="button"
              onClick={loadPageData}
              className="p4g-button p4g-button-dark"
            >
              再読み込み
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm font-bold text-white/80">読み込み中...</p>
          ) : invitations.length === 0 ? (
            <p className="mt-4 text-sm font-bold text-white/80">
              招待リンクはまだありません。
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      Role
                    </th>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      Department
                    </th>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      Status
                    </th>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      Expires
                    </th>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      URL
                    </th>
                    <th className="px-3 text-left text-xs font-black uppercase tracking-[0.16em] text-[#ffe76a]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invitations.map((item) => {
                    const inviteUrl = buildInviteUrl(item.token);

                    return (
                      <tr key={item.id}>
                        <td className="rounded-l-[18px] border-y-[3px] border-l-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-black text-black">
                          {item.role}
                        </td>

                        <td className="border-y-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-black text-black">
                          {item.departmentName}
                        </td>

                        <td className="border-y-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-black text-black">
                          {item.status}
                        </td>

                        <td className="border-y-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-black text-black">
                          {formatDate(item.expiresAt)}
                        </td>

                        <td className="border-y-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-bold text-black">
                          <div className="max-w-[320px] break-all">
                            {inviteUrl || item.token}
                          </div>
                          {copiedToken === item.token && (
                            <p className="mt-1 text-xs font-black text-[#104e14]">
                              コピーしました
                            </p>
                          )}
                        </td>

                        <td className="rounded-r-[18px] border-y-[3px] border-r-[3px] border-black bg-[#fff8d9] px-3 py-3 text-sm font-black text-black">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(item.token)}
                              className="p4g-button p4g-button-blue"
                            >
                              URLコピー
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRevoke(item.id, item.status)}
                              disabled={item.status !== "active"}
                              className="p4g-button p4g-button-red disabled:opacity-50"
                            >
                              無効化
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
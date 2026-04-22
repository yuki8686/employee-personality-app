"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { getDiagnosticsForUi } from "@/lib/diagnostics/current";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  status?: string;
};

type DiagnosticData = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
  businessTypeName?: string;
  confidence?: number;
  diagnosedAt?: string;
};

type MemberCard = {
  uid: string;
  name: string;
  nameKana: string;
  role: string;
  departmentName: string;
  status: string;
  mbti: string;
  businessCode: string;
  businessTypeName: string;
  isSelf: boolean;
};

type DepartmentBlock = {
  departmentName: string;
  members: MemberCard[];
};

function normalizeRole(value?: string) {
  return (value || "").trim().toLowerCase();
}

function canAccessOrgMap(role?: string) {
  const normalized = normalizeRole(role);
  return (
    normalized === "admin" ||
    normalized === "manager" ||
    normalized === "employee"
  );
}

function canOpenOtherProfile(role?: string) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function statusLabel(status?: string, isSelf?: boolean) {
  if (isSelf) return "YOU";
  const normalized = (status || "").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  if (normalized === "disabled") return "disabled";
  return "-";
}

function statusBadgeClass(status?: string, isSelf?: boolean) {
  if (isSelf) return "bg-[#f3c400] text-black";
  const normalized = (status || "").toLowerCase();
  if (normalized === "active") return "bg-[#f3c400] text-black";
  if (normalized === "pending") return "bg-[#fff2a6] text-black";
  if (normalized === "disabled") return "bg-[#ffd0d0] text-black";
  return "bg-white text-black";
}

async function loadDiagnosticsByUserIds(
  userIds: string[]
): Promise<Map<string, DiagnosticData>> {
  const diagnosticsMap = new Map<string, DiagnosticData>();

  if (userIds.length === 0) return diagnosticsMap;

  const chunks = chunkArray(userIds, 10);

  for (const ids of chunks) {
    const q = query(
      collection(db, "diagnostics_current"),
      where(documentId(), "in", ids)
    );
    const snap = await getDocs(q);

    snap.forEach((item) => {
      const data = item.data() as {
        userId?: string;
        mbti?: {
          type?: string;
          confidence?: number;
        };
        businessPersonality?: {
          primaryType?: string;
          typeName?: string;
          confidence?: number;
        };
        diagnosedAt?: string;
      };

      const mbtiCode = data.mbti?.type || "-";
      const businessCode = data.businessPersonality?.primaryType || "-";

      diagnosticsMap.set(item.id, {
        userId: data.userId || item.id,
        mbti: mbtiCode,
        businessCode,
        businessTypeName: getBusinessTypeName(businessCode),
        confidence:
          typeof data.businessPersonality?.confidence === "number"
            ? data.businessPersonality.confidence
            : typeof data.mbti?.confidence === "number"
              ? data.mbti.confidence
              : 0,
        diagnosedAt: data.diagnosedAt || "",
      });
    });
  }

  return diagnosticsMap;
}

function toMemberCard(
  item: QueryDocumentSnapshot,
  diagnosticsMap: Map<string, DiagnosticData>,
  selfUid: string
): MemberCard {
  const data = item.data() as Omit<UserProfile, "uid">;
  const diagnostic = diagnosticsMap.get(item.id);
  const mbtiCode = diagnostic?.mbti || "-";
  const businessCode = diagnostic?.businessCode || "-";

  return {
    uid: item.id,
    name: data.name || "名称未設定",
    nameKana: data.nameKana || "",
    role: data.role || "-",
    departmentName: data.departmentName || "-",
    status: (data.status || "active").toLowerCase(),
    mbti: mbtiCode,
    businessCode,
    businessTypeName: getBusinessTypeName(businessCode),
    isSelf: item.id === selfUid,
  };
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
      <div className="absolute left-0 top-0 h-2.5 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3.5 w-3.5 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-3.5 pt-5 md:p-5 md:pt-7">
        {title && (
          <div className="mb-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:tracking-normal md:shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export default function OrgMapPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [members, setMembers] = useState<MemberCard[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const myUserRef = doc(db, "users", user.uid);
        const myUserSnap = await getDoc(myUserRef);

        if (!myUserSnap.exists()) {
          router.push("/login");
          return;
        }

        const myData = myUserSnap.data() as Omit<UserProfile, "uid">;
        const nextMe: UserProfile = {
          ...myData,
          uid: user.uid,
        };
        setMe(nextMe);

        const myDiagnostic = await getDiagnosticsForUi(user.uid);
        const status = (nextMe.status || "active").toLowerCase();

        if (status === "pending" || !myDiagnostic) {
          router.push("/register/wizard");
          return;
        }

        const myRole = normalizeRole(nextMe.role);
        if (!canAccessOrgMap(myRole)) {
          router.push("/home");
          return;
        }

        const myDepartment = nextMe.departmentName || "";

        let usersSnap;
        if (myRole === "admin") {
          usersSnap = await getDocs(collection(db, "users"));
        } else if (myRole === "manager") {
          usersSnap = await getDocs(
            query(
              collection(db, "users"),
              where("departmentName", "==", myDepartment)
            )
          );
        } else {
          usersSnap = await getDocs(collection(db, "users"));
        }

        const docs = usersSnap.docs;
        const diagnosticsMap = await loadDiagnosticsByUserIds(
          docs.map((item) => item.id)
        );

        const nextMembers = docs
          .map((item) => toMemberCard(item, diagnosticsMap, user.uid))
          .sort((a, b) => {
            if (a.departmentName !== b.departmentName) {
              return a.departmentName.localeCompare(b.departmentName, "ja");
            }
            return a.name.localeCompare(b.name, "ja");
          });

        setMembers(nextMembers);
      } catch (error) {
        console.error("org-map 読み込み失敗:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const departmentBlocks = useMemo<DepartmentBlock[]>(() => {
    const map = new Map<string, MemberCard[]>();

    members.forEach((member) => {
      const key = member.departmentName || "未設定";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(member);
    });

    return Array.from(map.entries())
      .map(([departmentName, membersInDept]) => ({
        departmentName,
        members: membersInDept,
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName, "ja"));
  }, [members]);

  const normalizedRole = normalizeRole(me?.role);

  if (loading) {
    return (
      <P4LoadingScreen
        title="ORG MAP LOADING"
        subtitle="組織マップを読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  ORG MAP
                </div>
                <h1 className="mt-2.5 text-[24px] font-black leading-tight md:mt-4 md:text-4xl">
                  組織マップ
                </h1>
                <p className="mt-2 max-w-3xl text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  権限に応じた範囲のメンバー構成を確認できます。
                </p>
              </div>

              <div className="hidden xl:flex xl:flex-col xl:items-end xl:gap-2">
                <P4PageNav role={normalizedRole} />
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="PAGE MENU" className="hidden md:block xl:hidden">
            <P4PageNav role={normalizedRole} />
          </PanelFrame>

          {departmentBlocks.length === 0 ? (
            <PanelFrame title="部署ブロック">
              <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                  表示できるメンバーがいません。
                </p>
              </div>
            </PanelFrame>
          ) : (
            departmentBlocks.map((block) => (
              <PanelFrame key={block.departmentName} title="部署ブロック">
                <div className="mb-3.5 flex items-center justify-between gap-3 md:mb-5 md:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[22px] font-black leading-tight md:text-3xl">
                      {block.departmentName || "-"}
                    </h2>
                  </div>

                  <div className="shrink-0 rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-base md:shadow-[0_4px_0_#000]">
                    {block.members.length}名
                  </div>
                </div>

                <div className="grid gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {block.members.map((member) => (
                    <div
                      key={member.uid}
                      className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[18px] font-black leading-tight md:text-2xl">
                            {member.name}
                          </p>
                          {member.nameKana && (
                            <p className="mt-1 text-[12px] font-black tracking-[0.04em] text-[#ffe46a] md:text-sm md:tracking-[0.08em]">
                              {member.nameKana}
                            </p>
                          )}
                          <p className="mt-1 text-[12px] font-bold leading-5 text-white/70 md:text-sm md:leading-6">
                            {member.role}
                          </p>
                        </div>

                        <div
                          className={`shrink-0 rounded-full border-[3px] border-black px-3 py-1 text-[11px] font-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000] ${statusBadgeClass(
                            member.status,
                            member.isSelf
                          )}`}
                        >
                          {statusLabel(member.status, member.isSelf)}
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-2.5 text-[13px] font-bold leading-6 text-white/85 md:mt-5 md:space-y-3 md:text-sm md:leading-7">
                        <p>部署: {member.departmentName || "-"}</p>

                        <div>
                          <p>MBTI: {member.mbti || "-"}</p>
                          <p className="mt-0.5 text-[11px] leading-5 text-white/70 md:mt-1 md:text-xs">
                            {getMbtiTypeName(member.mbti)}
                          </p>
                        </div>

                        <div>
                          <p>ビジネス人格: {member.businessCode || "-"}</p>
                          <p className="mt-0.5 text-[11px] leading-5 text-white/70 md:mt-1 md:text-xs">
                            {getBusinessTypeName(member.businessCode)}
                          </p>
                        </div>
                      </div>

                      {!member.isSelf && canOpenOtherProfile(normalizedRole) && (
                        <div className="mt-4 md:mt-5">
                          <Link
                            href={`/profile/${member.uid}`}
                            className="inline-flex rounded-[12px] border-[3px] border-black bg-[#111111] px-4 py-2 text-[12px] font-black text-white shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] md:rounded-[16px] md:text-sm md:shadow-[0_6px_0_#000]"
                          >
                            詳細を見る
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </PanelFrame>
            ))
          )}
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}
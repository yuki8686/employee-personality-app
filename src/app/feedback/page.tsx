"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type Role = "admin" | "manager" | "employee" | "partner";
type UserStatus = "active" | "pending" | "disabled";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: Role | string;
  departmentName?: string;
  partnerCompany?: string;
  status?: UserStatus | string;
};

type FeedbackSection = {
  id: string;
  title: string;
  content: string;
  order: number;
  isDefault?: boolean;
};

type FeedbackItem = {
  id: string;
  fromUid: string;
  fromName: string;
  fromNameKana?: string;
  fromRole: string;
  toUid: string;
  toName: string;
  toNameKana?: string;
  toRole: string;
  departmentName: string;
  category: string;
  message: string;
  sections: FeedbackSection[];
  createdAt: string;
  updatedAt?: string;
};

type RecipientOption = {
  uid: string;
  name: string;
  nameKana: string;
  role: string;
  departmentName: string;
};

type ComposeSection = {
  id: string;
  title: string;
  content: string;
  order: number;
};

type RecipientSnapshotRow = RecipientOption & {
  status: string;
};

function createDefaultSections(): ComposeSection[] {
  return [
    { id: "challenge", title: "課題", content: "", order: 0 },
    { id: "impression", title: "印象", content: "", order: 1 },
    { id: "expectation", title: "期待", content: "", order: 2 },
    { id: "comment", title: "コメント", content: "", order: 3 },
  ];
}

function formatDisplayDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeFeedbackItem(
  raw: Record<string, unknown>,
  id: string
): FeedbackItem {
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];

  const sections: FeedbackSection[] = rawSections
    .map((section, index) => {
      const value = section as Record<string, unknown>;
      return {
        id:
          typeof value.id === "string" && value.id.trim() !== ""
            ? value.id
            : `section-${id}-${index}`,
        title: typeof value.title === "string" ? value.title : "",
        content: typeof value.content === "string" ? value.content : "",
        order: typeof value.order === "number" ? value.order : index,
        isDefault: value.isDefault === true,
      };
    })
    .sort((a, b) => a.order - b.order);

  return {
    id,
    fromUid: typeof raw.fromUid === "string" ? raw.fromUid : "",
    fromName: typeof raw.fromName === "string" ? raw.fromName : "不明",
    fromNameKana:
      typeof raw.fromNameKana === "string" ? raw.fromNameKana : "",
    fromRole: typeof raw.fromRole === "string" ? raw.fromRole : "-",
    toUid: typeof raw.toUid === "string" ? raw.toUid : "",
    toName: typeof raw.toName === "string" ? raw.toName : "名称未設定",
    toNameKana: typeof raw.toNameKana === "string" ? raw.toNameKana : "",
    toRole: typeof raw.toRole === "string" ? raw.toRole : "-",
    departmentName:
      typeof raw.departmentName === "string" ? raw.departmentName : "-",
    category:
      typeof raw.category === "string" ? raw.category : "structured_feedback",
    message: typeof raw.message === "string" ? raw.message : "",
    sections,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function buildFeedbackMessage(sections: ComposeSection[]): string {
  return sections
    .map((section, index) => {
      const title = section.title.trim() || `項目${index + 1}`;
      const content = section.content.trim();
      if (!content) return "";
      return `${title}\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function normalizeRole(value?: string): Role | "" {
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

function isAdmin(role?: string) {
  return normalizeRole(role) === "admin";
}

function isManager(role?: string) {
  return normalizeRole(role) === "manager";
}

function canAccessFeedbackPage(role?: string) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
}

function isSameDepartment(a?: string, b?: string) {
  return (a || "").trim().toLowerCase() !== "" &&
    (b || "").trim().toLowerCase() !== "" &&
    (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

function canSendFeedbackToTarget(
  currentUser: UserProfile,
  target: RecipientSnapshotRow
) {
  const currentRole = normalizeRole(currentUser.role);
  const targetRole = normalizeRole(target.role);
  const targetStatus = (target.status || "").trim().toLowerCase();

  if (!canAccessFeedbackPage(currentRole)) return false;
  if (!currentUser.uid || !target.uid) return false;
  if (currentUser.uid === target.uid) return false;
  if (targetStatus === "disabled") return false;

  if (currentRole === "admin") {
    return true;
  }

  if (currentRole === "manager") {
    if (targetRole === "admin") return false;
    return isSameDepartment(currentUser.departmentName, target.departmentName);
  }

  return false;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function enrichFeedbacksWithKana(items: FeedbackItem[]): Promise<FeedbackItem[]> {
  const userIds = Array.from(
    new Set(items.flatMap((item) => [item.fromUid, item.toUid]).filter(Boolean))
  );

  if (userIds.length === 0) return items;

  const userMap = new Map<string, { nameKana: string }>();
  const chunks = chunkArray(userIds, 10);

  for (const ids of chunks) {
    const snap = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", ids))
    );

    snap.forEach((userSnap) => {
      const data = userSnap.data() as UserProfile;
      userMap.set(userSnap.id, {
        nameKana: data.nameKana || "",
      });
    });
  }

  return items.map((item) => ({
    ...item,
    fromNameKana: item.fromNameKana || userMap.get(item.fromUid)?.nameKana || "",
    toNameKana: item.toNameKana || userMap.get(item.toUid)?.nameKana || "",
  }));
}

async function loadVisibleFeedbacks(me: UserProfile): Promise<FeedbackItem[]> {
  let items: FeedbackItem[] = [];

  if (isAdmin(me.role)) {
    const snap = await getDocs(collection(db, "feedbacks"));
    items = snap.docs
      .map((snapshot) =>
        normalizeFeedbackItem(
          snapshot.data() as Record<string, unknown>,
          snapshot.id
        )
      )
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return enrichFeedbacksWithKana(items);
  }

  if (isManager(me.role)) {
    const deptUsersSnap = await getDocs(
      query(
        collection(db, "users"),
        where("departmentName", "==", me.departmentName || "")
      )
    );

    const deptUserIds = deptUsersSnap.docs.map((snapshot) => snapshot.id);

    if (deptUserIds.length === 0) {
      return [];
    }

    const chunks = chunkArray(deptUserIds, 10);
    const feedbackMap = new Map<string, FeedbackItem>();

    for (const ids of chunks) {
      const snap = await getDocs(
        query(collection(db, "feedbacks"), where("toUid", "in", ids))
      );

      snap.docs.forEach((snapshot) => {
        const item = normalizeFeedbackItem(
          snapshot.data() as Record<string, unknown>,
          snapshot.id
        );
        feedbackMap.set(snapshot.id, item);
      });
    }

    items = Array.from(feedbackMap.values()).sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
    return enrichFeedbacksWithKana(items);
  }

  const snap = await getDocs(
    query(collection(db, "feedbacks"), where("toUid", "==", me.uid))
  );

  items = snap.docs
    .map((snapshot) =>
      normalizeFeedbackItem(snapshot.data() as Record<string, unknown>, snapshot.id)
    )
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return enrichFeedbacksWithKana(items);
}

function PanelFrame({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border-[4px] border-black bg-[#171717] shadow-[0_10px_0_#000]">
      <div className="absolute left-0 top-0 h-3 w-full bg-[#f3c400]" />
      <div className="absolute right-4 top-4 h-4 w-4 rotate-45 border-2 border-black bg-[#ffe46a]" />
      <div className="relative p-5 pt-7">
        {title && (
          <div className="mb-4 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black text-black shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function AccentButton({
  href,
  children,
  dark = false,
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-[16px] border-[3px] border-black px-4 py-2 text-sm font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] ${
        dark
          ? "bg-[#111111] text-white hover:bg-[#1d1d1d]"
          : "bg-[#f3c400] text-black hover:bg-[#ffe15a]"
      }`}
    >
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-y-0 left-0 w-2 bg-white/15 transition-all duration-200 group-hover:w-4" />
    </Link>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [recipientStatusMap, setRecipientStatusMap] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  const [targetUid, setTargetUid] = useState("");
  const [sections, setSections] = useState<ComposeSection[]>(createDefaultSections());
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
          router.push("/login");
          return;
        }

        const me = {
          ...(userSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        };

        if (!canAccessFeedbackPage(me.role)) {
          router.push("/home");
          return;
        }

        let usersSnap;
        if (isAdmin(me.role)) {
          usersSnap = await getDocs(collection(db, "users"));
        } else {
          usersSnap = await getDocs(
            query(
              collection(db, "users"),
              where("departmentName", "==", me.departmentName || "")
            )
          );
        }

        const recipientStatuses: Record<string, string> = {};

        const nextRecipients: RecipientOption[] = usersSnap.docs
          .map((snapshot) => {
            const data = snapshot.data() as UserProfile;
            const status = data.status || "active";

            recipientStatuses[snapshot.id] = status;

            return {
              uid: snapshot.id,
              name: data.name || "名称未設定",
              nameKana: data.nameKana || "",
              role: data.role || "-",
              departmentName: data.departmentName || "-",
              status,
            };
          })
          .filter((item): item is RecipientSnapshotRow =>
            canSendFeedbackToTarget(me, item as RecipientSnapshotRow)
          )
          .sort((a, b) => {
            const dept = a.departmentName.localeCompare(b.departmentName, "ja");
            if (dept !== 0) return dept;
            return a.name.localeCompare(b.name, "ja");
          })
          .map(({ status: _status, ...item }) => item);

        const items = await loadVisibleFeedbacks(me);

        setCurrentUser(me);
        setRecipients(nextRecipients);
        setRecipientStatusMap(recipientStatuses);
        setFeedbacks(items);

        if (nextRecipients.length > 0) {
          setTargetUid(nextRecipients[0].uid);
        } else {
          setTargetUid("");
        }
      } catch (e) {
        console.error("feedback 読み込み失敗:", e);
        setFormError("フィードバック画面の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const normalizedRole = normalizeRole(currentUser?.role);

  const selectedRecipient = useMemo(() => {
    return recipients.find((item) => item.uid === targetUid) || null;
  }, [recipients, targetUid]);

  const grouped = useMemo(() => feedbacks, [feedbacks]);

  function updateSectionTitle(id: string, value: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, title: value } : section
      )
    );
  }

  function updateSectionContent(id: string, value: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, content: value } : section
      )
    );
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        title: `項目${prev.length + 1}`,
        content: "",
        order: prev.length,
      },
    ]);
  }

  async function reloadVisibleFeedbacks(me: UserProfile) {
    const items = await loadVisibleFeedbacks(me);
    setFeedbacks(items);
  }

  async function handleSubmit() {
    setFormError("");
    setSuccessMessage("");

    if (!currentUser) {
      setFormError("ログイン情報の取得に失敗しました。");
      return;
    }

    if (!canAccessFeedbackPage(currentUser.role)) {
      setFormError("このアカウントには送信権限がありません。");
      return;
    }

    if (!selectedRecipient) {
      setFormError("送信先を選択してください。");
      return;
    }

    const submitTarget: RecipientSnapshotRow = {
      ...selectedRecipient,
      status: recipientStatusMap[selectedRecipient.uid] || "active",
    };

    if (!canSendFeedbackToTarget(currentUser, submitTarget)) {
      setFormError("このユーザーにはフィードバックを送信できません。");
      return;
    }

    const normalizedSections = sections.map((section, index) => ({
      ...section,
      title: section.title.trim() || `項目${index + 1}`,
      content: section.content.trim(),
      order: index,
    }));

    const hasAnyContent = normalizedSections.some((section) => section.content !== "");
    if (!hasAnyContent) {
      setFormError("少なくとも1項目は入力してください。");
      return;
    }

    const now = new Date().toISOString();
    const payloadSections: FeedbackSection[] = normalizedSections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      order: section.order,
      isDefault: false,
    }));

    const message = buildFeedbackMessage(normalizedSections);

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedbacks"), {
        fromUid: currentUser.uid,
        fromName: currentUser.name || "名称未設定",
        fromNameKana: currentUser.nameKana || "",
        fromRole: currentUser.role || "-",
        toUid: selectedRecipient.uid,
        toName: selectedRecipient.name,
        toNameKana: selectedRecipient.nameKana || "",
        toRole: selectedRecipient.role,
        departmentName: currentUser.departmentName || "-",
        category: "structured_feedback",
        message,
        sections: payloadSections,
        createdAt: now,
        updatedAt: now,
      });

      setSections(createDefaultSections());
      setSuccessMessage("フィードバックを送信しました。");

      await reloadVisibleFeedbacks(currentUser);
    } catch (e) {
      console.error("feedback 送信失敗:", e);
      setFormError("フィードバックの送信に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <P4LoadingScreen
        title="FEEDBACK LOADING"
        subtitle="受信フィードバックを読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-4 py-6 pb-24 md:pb-6 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <PanelFrame>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="inline-block rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black text-black shadow-[0_4px_0_#000]">
                  フィードバック
                </div>
                <h1 className="mt-3 text-3xl font-black">フィードバック一覧</h1>
                <p className="mt-2 text-sm font-bold text-white/80">
                  受信フィードバックの確認と、新規フィードバックの入力ができます。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:items-end md:gap-2">
                <P4PageNav role={normalizedRole} />
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="フィードバック送信">
            <h2 className="text-2xl font-black">フィードバック入力</h2>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[22px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000]">
                <label className="block text-xs font-black tracking-[0.15em] text-white/55">
                  送信先
                </label>
                <select
                  value={targetUid}
                  onChange={(event) => setTargetUid(event.target.value)}
                  className="mt-3 w-full rounded-[16px] border-[3px] border-black bg-[#f6f0d8] px-4 py-3 text-sm font-black text-black outline-none"
                >
                  {recipients.length === 0 ? (
                    <option value="">送信可能なユーザーがいません</option>
                  ) : (
                    recipients.map((recipient) => (
                      <option key={recipient.uid} value={recipient.uid}>
                        {recipient.name}
                        {recipient.nameKana ? ` (${recipient.nameKana})` : ""} /{" "}
                        {recipient.role} / {recipient.departmentName}
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-4 rounded-[18px] border-[3px] border-black bg-[#1a1a1a] p-4 shadow-[0_6px_0_#000]">
                  <p className="text-xs font-black tracking-[0.15em] text-white/55">
                    選択中
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {selectedRecipient?.name || "-"}
                  </p>
                  {selectedRecipient?.nameKana && (
                    <p className="mt-1 text-sm font-black tracking-[0.08em] text-[#ffe46a]">
                      {selectedRecipient.nameKana}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-bold text-white/75">
                    {selectedRecipient?.role || "-"} /{" "}
                    {selectedRecipient?.departmentName || "-"}
                  </p>
                </div>

                {formError && (
                  <div className="mt-4 rounded-[16px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-sm font-black text-[#7b1111] shadow-[0_4px_0_#000]">
                    {formError}
                  </div>
                )}

                {successMessage && (
                  <div className="mt-4 rounded-[16px] border-[3px] border-black bg-[#fff27a] px-4 py-3 text-sm font-black text-black shadow-[0_4px_0_#000]">
                    {successMessage}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || recipients.length === 0}
                    className="inline-flex rounded-[16px] border-[3px] border-black bg-[#f3c400] px-5 py-3 text-sm font-black text-black shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "送信中..." : "フィードバックを送信"}
                  </button>

                  <button
                    type="button"
                    onClick={addSection}
                    className="inline-flex rounded-[16px] border-[3px] border-black bg-[#111111] px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000]"
                  >
                    項目を追加
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="rounded-[22px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000]"
                  >
                    <label className="block text-xs font-black tracking-[0.15em] text-white/55">
                      項目名
                    </label>
                    <input
                      value={section.title}
                      onChange={(event) =>
                        updateSectionTitle(section.id, event.target.value)
                      }
                      className="mt-3 w-full rounded-[16px] border-[3px] border-black bg-[#f6f0d8] px-4 py-3 text-sm font-black text-black outline-none"
                      placeholder={`項目${index + 1}`}
                    />

                    <label className="mt-4 block text-sm font-black text-[#ffe46a]">
                      内容
                    </label>
                    <textarea
                      value={section.content}
                      onChange={(event) =>
                        updateSectionContent(section.id, event.target.value)
                      }
                      rows={4}
                      className="mt-3 w-full resize-y rounded-[16px] border-[3px] border-black bg-[#f6f0d8] px-4 py-3 text-sm font-bold text-black outline-none"
                      placeholder={`${section.title || `項目${index + 1}`} を入力`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </PanelFrame>

          {grouped.length === 0 && (
            <PanelFrame title="一覧">
              <p className="font-bold">まだフィードバックがありません。</p>
            </PanelFrame>
          )}

          {grouped.map((fb) => (
            <PanelFrame key={fb.id} title="受信フィードバック">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{fb.fromName}</p>
                  {fb.fromNameKana && (
                    <p className="mt-1 text-sm font-black tracking-[0.08em] text-[#ffe46a]">
                      {fb.fromNameKana}
                    </p>
                  )}
                  <p className="text-sm opacity-70">
                    {fb.fromRole} / {fb.departmentName}
                  </p>
                </div>
                <p className="text-xs font-black tracking-[0.15em] text-white/50">
                  {formatDisplayDate(fb.createdAt)}
                </p>
              </div>

              <div className="grid gap-4">
                {fb.sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="rounded-[16px] border-[3px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000]"
                  >
                    <p className="text-sm font-black text-[#ffe46a]">{sec.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-bold">
                      {sec.content || "(未入力)"}
                    </p>
                  </div>
                ))}
              </div>
            </PanelFrame>
          ))}
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}
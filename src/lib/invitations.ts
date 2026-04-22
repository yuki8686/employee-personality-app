import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  InvitationDoc,
  InvitationStatus,
  UserRole,
} from "@/types/firestore";

const INVITATIONS_COLLECTION = "invitations";

function createInviteToken(length = 32) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getInvitationStatusByDate(
  invitation: Pick<InvitationDoc, "status" | "expiresAt">
): InvitationStatus {
  if (invitation.status === "used") return "used";
  if (invitation.status === "revoked") return "revoked";

  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);

  if (Number.isNaN(expiresAt.getTime())) return "expired";
  if (expiresAt.getTime() < now.getTime()) return "expired";

  return "active";
}

export async function createInvitation(params: {
  role: UserRole;
  departmentId: string;
  departmentName: string;
  issuedBy: string;
}) {
  const now = new Date();
  const expiresAt = addDays(now, 7);

  const payload: Omit<InvitationDoc, "id"> = {
    token: createInviteToken(),
    role: params.role,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    issuedBy: params.issuedBy,
    expiresAt: expiresAt.toISOString(),
    usedBy: "",
    status: "active",
    createdAt: now.toISOString(),
  };

  const ref = await addDoc(collection(db, INVITATIONS_COLLECTION), {
    ...payload,
    createdAtServer: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...payload,
  };
}

export async function findInvitationByToken(token: string) {
  const snap = await getDocs(
    query(
      collection(db, INVITATIONS_COLLECTION),
      where("token", "==", token)
    )
  );

  if (snap.empty) return null;

  const inviteDoc = snap.docs[0];
  const invitation = {
    id: inviteDoc.id,
    ...(inviteDoc.data() as Omit<InvitationDoc, "id">),
  };

  const currentStatus = getInvitationStatusByDate(invitation);

  if (currentStatus !== invitation.status) {
    await updateDoc(doc(db, INVITATIONS_COLLECTION, inviteDoc.id), {
      status: currentStatus,
      updatedAtServer: serverTimestamp(),
    });

    invitation.status = currentStatus;
  }

  return invitation;
}

export async function validateInvitationToken(token: string) {
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    return {
      ok: false,
      reason: "招待リンクが見つかりません。",
      invitation: null,
    };
  }

  const status = getInvitationStatusByDate(invitation);

  if (status !== "active") {
    const messageMap: Record<InvitationStatus, string> = {
      active: "",
      used: "この招待リンクはすでに使用済みです。",
      expired: "この招待リンクは期限切れです。",
      revoked: "この招待リンクは無効化されています。",
    };

    return {
      ok: false,
      reason: messageMap[status],
      invitation,
    };
  }

  return {
    ok: true,
    reason: "",
    invitation,
  };
}

export async function markInvitationUsed(
  invitationId: string,
  usedBy: string
) {
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    status: "used",
    usedBy,
    usedAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function revokeInvitation(invitationId: string) {
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    status: "revoked",
    updatedAtServer: serverTimestamp(),
  });
}
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, updateDoc, doc, db, getDocs } from "../utils/firestore";
import { ParticipantDoc, ParticipantRole } from "../../types";

interface TeamMember {
  oderId: string;
  displayName?: string;
  role: ParticipantRole;
  points: number;
}

interface UseTeamLeadOptions {
  sessionId: string | null;
  teamId: string | null;
  userId: string | null;
}

export function useTeamLead({ sessionId, teamId, userId }: UseTeamLeadOptions) {
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [teamLeadId, setTeamLeadId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [canClaimLead, setCanClaimLead] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to team members
  useEffect(() => {
    if (!sessionId || !teamId) {
      setTeamMembers([]);
      setTeamLeadId(null);
      setIsTeamLead(false);
      setCanClaimLead(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const participantsRef = collection(db, "sessions", sessionId, "participants");

    const unsub = onSnapshot(
      participantsRef,
      (snapshot: any) => {
        const docs = snapshot.docs ?? snapshot;
        const members: TeamMember[] = [];
        let leadId: string | null = null;

        docs.forEach((docSnap: any) => {
          const data = docSnap.data() as ParticipantDoc;
          if (data && data.teamId === teamId) {
            const role: ParticipantRole = data.role ?? "member";
            members.push({
              oderId: data.userId,
              displayName: data.displayName,
              role,
              points: data.points ?? 0,
            });
            if (role === "lead") {
              leadId = data.userId;
            }
          }
        });

        // Sort by points descending
        members.sort((a, b) => b.points - a.points);

        setTeamMembers(members);
        setTeamLeadId(leadId);
        setIsTeamLead(leadId === userId);
        setCanClaimLead(leadId === null && members.length > 0);
        setLoading(false);
      },
      (err: any) => {
        console.error("Team lead subscription error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [sessionId, teamId, userId]);

  // Claim team lead role
  const claimTeamLead = useCallback(async () => {
    if (!sessionId || !userId || !canClaimLead) {
      return { success: false, error: "Cannot claim team lead" };
    }

    try {
      // Double-check no one else has claimed it
      const participantsRef = collection(db, "sessions", sessionId, "participants");
      const snapshot = await getDocs(participantsRef);
      const docs = (snapshot as any).docs ?? snapshot;

      let existingLead = false;
      docs.forEach((docSnap: any) => {
        const data = docSnap.data() as ParticipantDoc;
        if (data?.teamId === teamId && data?.role === "lead") {
          existingLead = true;
        }
      });

      if (existingLead) {
        return { success: false, error: "Another team member already claimed lead" };
      }

      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      await updateDoc(participantRef, { role: "lead" });
      return { success: true };
    } catch (err: any) {
      console.error("Failed to claim team lead:", err);
      return { success: false, error: err.message || "Failed to claim team lead" };
    }
  }, [sessionId, teamId, userId, canClaimLead]);

  // Resign from team lead role
  const resignTeamLead = useCallback(async () => {
    if (!sessionId || !userId || !isTeamLead) {
      return { success: false, error: "Not team lead" };
    }

    try {
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      await updateDoc(participantRef, { role: "member" });
      return { success: true };
    } catch (err: any) {
      console.error("Failed to resign team lead:", err);
      return { success: false, error: err.message || "Failed to resign" };
    }
  }, [sessionId, userId, isTeamLead]);

  return {
    isTeamLead,
    teamLeadId,
    teamMembers,
    canClaimLead,
    claimTeamLead,
    resignTeamLead,
    loading,
  };
}

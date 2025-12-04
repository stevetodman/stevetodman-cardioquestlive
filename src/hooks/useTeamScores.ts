import { useEffect, useState } from "react";
import { collection, onSnapshot, db } from "../utils/firestore";
import { ParticipantDoc } from "../types";

export interface TeamScore {
  teamId: string;
  teamName: string;
  points: number;
}

export function useTeamScores(sessionId?: string | null) {
  const [teams, setTeams] = useState<TeamScore[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref, (snapshot: any) => {
      const totals = new Map<string, TeamScore>();
      const docs = snapshot.docs ?? snapshot;
      docs.forEach((docSnap: any) => {
        const data: ParticipantDoc = docSnap.data();
        const teamId = data?.teamId ?? "unknown";
        const teamName = data?.teamName ?? "Team";
        const current = totals.get(teamId) ?? { teamId, teamName, points: 0 };
        current.points += data?.points ?? 0;
        current.teamName = teamName;
        totals.set(teamId, current);
      });
      const sorted = Array.from(totals.values()).sort((a, b) => b.points - a.points);
      setTeams(sorted);
    });
    return () => unsub();
  }, [sessionId]);

  return teams;
}

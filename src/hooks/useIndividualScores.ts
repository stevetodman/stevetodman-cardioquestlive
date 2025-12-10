import { useEffect, useState } from "react";
import { collection, onSnapshot, db } from "../utils/firestore";
import { ParticipantDoc } from "../types";

export interface IndividualScore {
  userId: string;
  points: number;
  teamId: string;
  teamName: string;
  displayName?: string;
  inactive?: boolean;
}

const DEFAULT_LIMIT = 5;

export function useIndividualScores(sessionId?: string | null, limit: number = DEFAULT_LIMIT) {
  const [players, setPlayers] = useState<IndividualScore[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      const scores: IndividualScore[] = [];
      docs.forEach((docSnap: any) => {
        const data: ParticipantDoc = docSnap.data();
        scores.push({
          userId: data?.userId ?? docSnap.id,
          points: data?.points ?? 0,
          teamId: data?.teamId ?? "unknown",
          teamName: data?.teamName ?? "Team",
          displayName: data?.displayName,
          inactive: data?.inactive,
        });
      });
      const sorted = scores.sort((a, b) => b.points - a.points).slice(0, limit);
      setPlayers(sorted);
    });
    return () => unsub();
  }, [sessionId, limit]);

  return players;
}

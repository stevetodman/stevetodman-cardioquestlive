/**
 * Generic hook for subscribing to participants collection.
 * Reduces duplication between useTeamScores, useIndividualScores, etc.
 */

import { useEffect, useState } from "react";
import { collection, onSnapshot, db } from "../utils/firestore";
import type { ParticipantDoc } from "../types";

export type ParticipantMapper<T> = (docs: ParticipantDoc[], docIds: string[]) => T;

/**
 * Subscribe to participants collection and transform with a mapper function.
 * @param sessionId - Session to subscribe to
 * @param mapper - Function to transform participant docs into desired shape
 * @param deps - Additional dependencies that should trigger re-subscription
 */
export function useParticipantsCollection<T>(
  sessionId: string | null | undefined,
  mapper: ParticipantMapper<T>,
  deps: unknown[] = []
): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      return;
    }

    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      const participants: ParticipantDoc[] = [];
      const docIds: string[] = [];

      docs.forEach((docSnap: any) => {
        participants.push(docSnap.data() as ParticipantDoc);
        docIds.push(docSnap.id);
      });

      setData(mapper(participants, docIds));
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, ...deps]);

  return data;
}

// ============================================================================
// Pre-built mappers for common use cases
// ============================================================================

export interface TeamScore {
  teamId: string;
  teamName: string;
  points: number;
}

export interface IndividualScore {
  odcId: string;
  userId: string;
  displayName?: string;
  points: number;
  teamId: string;
  teamName: string;
}

/** Map participants to team scores (aggregated by team) */
export function mapToTeamScores(docs: ParticipantDoc[]): TeamScore[] {
  const totals = new Map<string, TeamScore>();

  for (const data of docs) {
    const teamId = data?.teamId ?? "unknown";
    const teamName = data?.teamName ?? "Team";
    const current = totals.get(teamId) ?? { teamId, teamName, points: 0 };
    current.points += data?.points ?? 0;
    current.teamName = teamName;
    totals.set(teamId, current);
  }

  return Array.from(totals.values()).sort((a, b) => b.points - a.points);
}

/** Map participants to individual scores (sorted by points) */
export function mapToIndividualScores(docs: ParticipantDoc[], docIds: string[], limit = 5): IndividualScore[] {
  const scores: IndividualScore[] = docs.map((data, i) => ({
    odcId: docIds[i],
    userId: data?.userId ?? docIds[i],
    displayName: data?.displayName,
    points: data?.points ?? 0,
    teamId: data?.teamId ?? "unknown",
    teamName: data?.teamName ?? "Team",
  }));

  return scores.sort((a, b) => b.points - a.points).slice(0, limit);
}

/** Get participant count */
export function mapToCount(docs: ParticipantDoc[]): number {
  return docs.length;
}

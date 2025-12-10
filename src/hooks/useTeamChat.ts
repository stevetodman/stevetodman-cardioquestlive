import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, addDoc, query, where, db, serverTimestamp } from "../utils/firestore";
import { orderBy, limit as fbLimit } from "firebase/firestore";
import { TeamMessageDoc } from "../../types";

export interface TeamMessage {
  id: string;
  userId: string;
  teamId: string;
  text: string;
  senderName?: string;
  createdAt: Date;
}

interface UseTeamChatOptions {
  sessionId: string | null;
  teamId: string | null;
  userId: string | null;
  senderName?: string;
  maxMessages?: number;
}

export function useTeamChat({
  sessionId,
  teamId,
  userId,
  senderName,
  maxMessages = 50,
}: UseTeamChatOptions) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(Date.now());

  // Subscribe to team messages
  useEffect(() => {
    if (!sessionId || !teamId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const messagesRef = collection(db, "sessions", sessionId, "teamMessages");

    // Query messages for this team, ordered by timestamp
    // Note: Firestore requires an index for compound queries
    const q = query(
      messagesRef,
      where("teamId", "==", teamId),
      // orderBy and limit may not be available in mock mode
    );

    const unsub = onSnapshot(
      q,
      (snapshot: any) => {
        const docs = snapshot.docs ?? snapshot;
        const newMessages: TeamMessage[] = [];

        docs.forEach((docSnap: any) => {
          const data = docSnap.data() as TeamMessageDoc;
          if (data && data.teamId === teamId) {
            const createdAt = data.createdAt?.toDate?.() ?? new Date(data.createdAt);
            newMessages.push({
              id: docSnap.id,
              userId: data.userId,
              teamId: data.teamId,
              text: data.text,
              senderName: data.senderName,
              createdAt,
            });
          }
        });

        // Sort by timestamp (oldest first for chat display)
        newMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        // Limit to most recent messages
        const limitedMessages = newMessages.slice(-maxMessages);
        setMessages(limitedMessages);

        // Update unread count (messages after lastReadTimestamp from other users)
        const newUnread = limitedMessages.filter(
          m => m.createdAt.getTime() > lastReadTimestamp && m.userId !== userId
        ).length;
        setUnreadCount(newUnread);

        setLoading(false);
      },
      (err: any) => {
        console.error("Team chat subscription error:", err);
        setError("Failed to load team messages");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [sessionId, teamId, maxMessages, lastReadTimestamp, userId]);

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !teamId || !userId || !text.trim()) {
        return { success: false, error: "Missing required fields" };
      }

      if (text.length > 500) {
        return { success: false, error: "Message too long (max 500 characters)" };
      }

      try {
        const messagesRef = collection(db, "sessions", sessionId, "teamMessages");
        await addDoc(messagesRef, {
          userId,
          teamId,
          text: text.trim(),
          senderName: senderName || "Anonymous",
          createdAt: serverTimestamp(),
        });
        return { success: true };
      } catch (err: any) {
        console.error("Failed to send team message:", err);
        return { success: false, error: err.message || "Failed to send message" };
      }
    },
    [sessionId, teamId, userId, senderName]
  );

  // Mark messages as read
  const markAsRead = useCallback(() => {
    setLastReadTimestamp(Date.now());
    setUnreadCount(0);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    unreadCount,
    markAsRead,
  };
}

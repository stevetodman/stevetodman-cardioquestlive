import { defaultDeck } from "../data/ductalDeck";
import type { DeckData } from "../types";
import { db, doc, getDoc, setDoc } from "./firestore";
import { isConfigured } from "../firebase";

const DECK_DOC_PATH = ["configs", "deck"] as const;

function sanitizeDeck(data?: Partial<DeckData> | null): DeckData {
  if (!data) return defaultDeck;
  return {
    title: data.title || defaultDeck.title,
    slides: Array.isArray(data.slides) && data.slides.length > 0 ? data.slides : defaultDeck.slides,
    questions:
      Array.isArray(data.questions) && data.questions.length > 0 ? data.questions : defaultDeck.questions,
    updatedAt: data.updatedAt,
  };
}

export async function fetchDeck(): Promise<DeckData> {
  if (!isConfigured) return defaultDeck;
  try {
    const ref = doc(db, ...DECK_DOC_PATH);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return sanitizeDeck(snap.data() as DeckData);
    }
  } catch (error) {
    console.warn("Failed to load deck config, using defaults", error);
  }
  return defaultDeck;
}

export async function persistDeck(deck: DeckData): Promise<void> {
  if (!isConfigured) {
    throw new Error("Firebase configuration required to save the deck.");
  }
  const ref = doc(db, ...DECK_DOC_PATH);
  await setDoc(ref, { ...deck, updatedAt: new Date().toISOString() });
}

import { Flashcard, FlashcardDeck } from '../../types';

export interface FlashcardQuizPrompt {
  card: Flashcard;
  prompt: string;
  correctAnswer: string;
  options: string[];
}

export function buildQuizPrompts(deck: FlashcardDeck, allDecks: FlashcardDeck[] = [], count = 12): FlashcardQuizPrompt[] {
  const cards = deck.cards.length > 0 ? deck.cards : [];
  if (cards.length === 0) return [];

  const externalPool = allDecks
    .flatMap((d) => d.cards)
    .map((c) => c.back)
    .filter(Boolean);

  const deckBackPool = cards.map((c) => c.back).filter(Boolean);

  const prompts: FlashcardQuizPrompt[] = [];
  for (let i = 0; i < count; i++) {
    const card = cards[i % cards.length];
    const distractorsSet = new Set<string>();

    const shuffledOwn = [...deckBackPool]
      .filter((b) => b !== card.back)
      .sort(() => Math.random() - 0.5);
    for (const candidate of shuffledOwn) {
      if (distractorsSet.size >= 3) break;
      distractorsSet.add(candidate);
    }

    if (distractorsSet.size < 3) {
      const shuffledExt = [...externalPool]
        .filter((b) => b !== card.back && !distractorsSet.has(b))
        .sort(() => Math.random() - 0.5);
      for (const candidate of shuffledExt) {
        if (distractorsSet.size >= 3) break;
        distractorsSet.add(candidate);
      }
    }

    const fallbackTexts = [
      'Khái niệm đối lập với định nghĩa gốc',
      'Phương pháp phân tích bổ sung',
      'Thuật ngữ thuộc chuyên đề khác',
      'Đáp án chưa chính xác'
    ];
    let fbIdx = 0;
    while (distractorsSet.size < 3 && fbIdx < fallbackTexts.length) {
      if (fallbackTexts[fbIdx] !== card.back) {
        distractorsSet.add(fallbackTexts[fbIdx]);
      }
      fbIdx++;
    }

    const options = [card.back, ...Array.from(distractorsSet).slice(0, 3)].sort(() => Math.random() - 0.5);
    prompts.push({
      card,
      prompt: card.front,
      correctAnswer: card.back,
      options
    });
  }

  return prompts;
}

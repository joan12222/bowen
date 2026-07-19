// Pure question-building logic for the coverage-style 实词 practice, shared by
// the per-word practice session (app/shici/practice) and the mistake-book redo
// mode (app/review/practice). Each example sentence of a word becomes one
// question; the options are *all* of that word's sense meanings.

export interface ExampleQuestion {
  word: any
  senses: any[]
  senseId: string
  exampleIndex: number
  sentence: string
  source: string
  translation: string
  answer: string // correct sense meaning
  options: string[] // all distinct sense meanings, shuffled
}

// referenceId for a mistake = `${senseId}#${exampleIndex}` (see lib/db.local.ts).
export function makeExampleRef(senseId: string, exampleIndex: number): string {
  return `${senseId}#${exampleIndex}`
}

export function parseExampleRef(referenceId: string): { senseId: string; exampleIndex: number } {
  const hash = referenceId.indexOf('#')
  if (hash === -1) return { senseId: referenceId, exampleIndex: 0 }
  return { senseId: referenceId.slice(0, hash), exampleIndex: Number(referenceId.slice(hash + 1)) || 0 }
}

function shuffle<T>(arr: T[]): T[] {
  return arr.slice().sort(() => Math.random() - 0.5)
}

// All distinct sense meanings of a word, shuffled — used as the option set.
export function buildOptions(senses: any[]): string[] {
  return shuffle([...new Set(senses.map((s) => s.meaning as string))])
}

// One question per example sentence across all senses of the word, randomised.
export function buildWordQuestions(word: any, senses: any[]): ExampleQuestion[] {
  const options = buildOptions(senses)
  const questions: ExampleQuestion[] = []
  for (const sense of senses) {
    const examples = (sense.examples as any[]) || []
    examples.forEach((ex, exampleIndex) => {
      questions.push({
        word,
        senses,
        senseId: sense.id as string,
        exampleIndex,
        sentence: ex.sentence,
        source: ex.source,
        translation: ex.translation,
        answer: sense.meaning as string,
        options,
      })
    })
  }
  return shuffle(questions)
}

// Build a single question for a specific example (used to restore a mistake).
export function buildExampleQuestion(word: any, senses: any[], senseId: string, exampleIndex: number): ExampleQuestion | null {
  const sense = senses.find((s) => s.id === senseId)
  if (!sense) return null
  const ex = (sense.examples as any[])?.[exampleIndex]
  if (!ex) return null
  return {
    word,
    senses,
    senseId,
    exampleIndex,
    sentence: ex.sentence,
    source: ex.source,
    translation: ex.translation,
    answer: sense.meaning as string,
    options: buildOptions(senses),
  }
}

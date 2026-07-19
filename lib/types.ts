export type VolumeId = 'required_1' | 'required_2' | 'selective_1' | 'selective_2' | 'selective_3' | 'custom'
export type TextType = 'wenyanwen' | 'gushici'

export interface Text {
  id: string
  title: string
  author: string
  dynasty: string
  source: string
  volumeId: VolumeId
  textType: TextType
  textOrder: number
  content: string
  translation?: string
  appreciation?: string
  isBuiltin: boolean
  createdAt: Date
}

export type AnnotationCategory = 'shiCi' | 'xuCi' | 'tongJia' | 'guJinYiYi' | 'ciLeiHuoYong' | 'teShüJuShi' | 'other'

export interface Annotation {
  id: string
  textId: string
  word: string
  pinyin: string
  context: string
  answer: string
  loose: string[]
  category: AnnotationCategory
  isHsfWord: boolean
  isBuiltin: boolean
  createdAt: Date
}

export interface Sentence {
  id: string
  textId: string
  original: string
  translation: string
  keyPoints: string[]
  difficulty: 1 | 2 | 3
  isBuiltin: boolean
  createdAt: Date
}

export interface RecitationQuestion {
  id: string
  textId: string
  prompt: string
  answer: string
  answerLines: string[]
  source: string
  isBuiltin: boolean
  createdAt: Date
}

export interface MultiMeaning {
  id: string
  character: string
  textId: string
  context: string
  meaning: string
  usage: string
}

export interface Mistake {
  id: string
  questionType: 'annotation' | 'translation' | 'recitation' | 'multiMeaning' | 'shici'
  referenceId: string
  userAnswer: string
  correctAnswer: string
  reviewCount: number
  nextReviewAt: Date
  isMastered: boolean
  createdAt: Date
  // context fields populated via JOIN
  annWord?: string
  annContext?: string
  annTextTitle?: string
  shiciCharacter?: string
  shiciExample?: string
  shiciSource?: string
}

export interface TextWithCounts extends Text {
  annotationCount: number
  sentenceCount: number
  recitationCount: number
}

export type PageKey = 'home' | 'category' | 'chinaCraft' | 'publish' | 'qa' | 'mine'

export type CraftKind = '通用手工' | '传统国风非遗'

export interface CraftCategory {
  id: string
  name: string
  kind: CraftKind
  icon: string
  accent: string
  description: string
  keywords: string[]
}

export interface Tutorial {
  id: string
  title: string
  categoryId: string
  kind: CraftKind
  difficulty: 1 | 2 | 3 | 4 | 5
  likes: number
  saves: number
  author: string
  duration: string
  image: string
  summary: string
  materials: string[]
  steps: string[]
  tags: string[]
  heritageNote?: string
  featured?: boolean
}

export interface FestivalTopic {
  id: string
  title: string
  subtitle: string
  categoryId: string
}

export interface QuestionItem {
  id: string
  title: string
  categoryId: string
  replies: number
  status: '待解答' | '已采纳' | '热议中'
  detail: string
}

export interface ExchangeItem {
  id: string
  title: string
  material: string
  location: string
  image: string
  note: string
}

export interface Challenge {
  id: string
  title: string
  description: string
  reward: string
  days: number
}

export interface CloudData {
  updatedAt: string
  categories: CraftCategory[]
  tutorials: Tutorial[]
  festivalTopics: FestivalTopic[]
  questions: QuestionItem[]
  exchanges: ExchangeItem[]
  challenge: Challenge
  blockedKeywords: string[]
  allowedKeywords: string[]
}

export interface PublishedWork {
  id: string
  title: string
  categoryId: string
  kind: CraftKind
  materials: string
  steps: string
  note: string
  createdAt: string
  imageData?: string
  aiScore: number
}

export interface AiReviewResult {
  passed: boolean
  score: number
  title: string
  message: string
  matched: string[]
  blocked: string[]
}

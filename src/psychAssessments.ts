export type AssessmentChoice = { label: string; value: number }
export type AssessmentItem = { id: string; prompt: string; reverse?: boolean }
export type AssessmentDefinition = {
  id: 'ipip20' | 'phq9' | 'gad7'
  title: string
  subtitle: string
  period?: string
  items: AssessmentItem[]
  choices: AssessmentChoice[]
}

export const ipip20: AssessmentDefinition = {
  id: 'ipip20',
  title: '大五人格 · IPIP',
  subtitle: '20 项人格特质测评',
  items: [
    { id: 'e1', prompt: '在聚会中，我通常能自然地和不同的人交谈。' },
    { id: 'e2', prompt: '我更喜欢待在不太引人注意的位置。', reverse: true },
    { id: 'e3', prompt: '我常常主动开启一段交流。' },
    { id: 'e4', prompt: '面对陌生人时，我通常比较安静。', reverse: true },
    { id: 'a1', prompt: '我会留意他人的感受。' },
    { id: 'a2', prompt: '我有时对别人的处境并不太感兴趣。', reverse: true },
    { id: 'a3', prompt: '我愿意花时间帮助别人。' },
    { id: 'a4', prompt: '发生分歧时，我容易只坚持自己的立场。', reverse: true },
    { id: 'c1', prompt: '我习惯提前把事情安排妥当。' },
    { id: 'c2', prompt: '我的物品有时会随手放置、缺少整理。', reverse: true },
    { id: 'c3', prompt: '开始一件事后，我通常会认真把它完成。' },
    { id: 'c4', prompt: '需要持续投入的任务容易让我拖延。', reverse: true },
    { id: 'n1', prompt: '遇到压力时，我很容易紧张或担心。' },
    { id: 'n2', prompt: '即使发生意外，我通常也能保持平静。', reverse: true },
    { id: 'n3', prompt: '我常常反复想着令人不安的事情。' },
    { id: 'n4', prompt: '我的情绪大多数时候比较稳定。', reverse: true },
    { id: 'o1', prompt: '我喜欢接触新的观念和体验。' },
    { id: 'o2', prompt: '抽象或想象性的话题通常不会吸引我。', reverse: true },
    { id: 'o3', prompt: '艺术、故事或新的观点常能激发我的想象。' },
    { id: 'o4', prompt: '我更偏好熟悉的方式，不太想尝试变化。', reverse: true },
  ],
  choices: [
    { label: '非常不像我', value: 1 },
    { label: '不太像我', value: 2 },
    { label: '一般', value: 3 },
    { label: '比较像我', value: 4 },
    { label: '非常像我', value: 5 },
  ],
}

export const phq9: AssessmentDefinition = {
  id: 'phq9',
  title: 'PHQ-9',
  subtitle: '抑郁症状筛查',
  period: '过去两周',
  items: [
    { id: 'p1', prompt: '做事时提不起兴趣或没有乐趣。' },
    { id: 'p2', prompt: '感到心情低落、沮丧或没有希望。' },
    { id: 'p3', prompt: '入睡困难、睡不安稳，或睡得过多。' },
    { id: 'p4', prompt: '感到疲倦或没有精力。' },
    { id: 'p5', prompt: '食欲不振，或吃得过多。' },
    { id: 'p6', prompt: '觉得自己很糟，或认为自己让自己或家人失望。' },
    { id: 'p7', prompt: '难以集中注意力，例如阅读或看视频时。' },
    { id: 'p8', prompt: '动作或说话变得很慢，或相反地坐立不安、活动明显增多。' },
    { id: 'p9', prompt: '出现“还不如不在了”或伤害自己的念头。' },
  ],
  choices: [
    { label: '完全没有', value: 0 },
    { label: '有几天', value: 1 },
    { label: '一半以上天数', value: 2 },
    { label: '几乎每天', value: 3 },
  ],
}

export const gad7: AssessmentDefinition = {
  id: 'gad7',
  title: 'GAD-7',
  subtitle: '焦虑症状筛查',
  period: '过去两周',
  items: [
    { id: 'g1', prompt: '感到紧张、焦虑或坐立不安。' },
    { id: 'g2', prompt: '无法停止或控制担忧。' },
    { id: 'g3', prompt: '对各种事情担忧过多。' },
    { id: 'g4', prompt: '很难放松下来。' },
    { id: 'g5', prompt: '因为不安而难以静坐。' },
    { id: 'g6', prompt: '变得容易烦躁或易怒。' },
    { id: 'g7', prompt: '感到好像会有可怕的事情发生。' },
  ],
  choices: [
    { label: '完全没有', value: 0 },
    { label: '有几天', value: 1 },
    { label: '一半以上天数', value: 2 },
    { label: '几乎每天', value: 3 },
  ],
}

export const assessments = { ipip20, phq9, gad7 }

function avg(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
}

export function scoreAssessment(def: AssessmentDefinition, responses: Record<string, number>) {
  if (def.id === 'ipip20') {
    const scored: Record<string, number> = {}
    def.items.forEach((item) => {
      const raw = responses[item.id] ?? 3
      scored[item.id] = item.reverse ? 6 - raw : raw
    })
    const factor = (prefix: string) => Math.round(((avg(Object.entries(scored).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v)) - 1) / 4) * 100)
    return {
      extraversion: factor('e'),
      agreeableness: factor('a'),
      conscientiousness: factor('c'),
      emotionalStability: 100 - factor('n'),
      openness: factor('o'),
    }
  }
  const total = def.items.reduce((sum, item) => sum + (responses[item.id] ?? 0), 0)
  if (def.id === 'phq9') {
    return { total, selfHarmItem: responses.p9 ?? 0, band: total < 5 ? '低' : total < 10 ? '轻度' : total < 15 ? '中度' : total < 20 ? '中重度' : '重度' }
  }
  return { total, band: total < 5 ? '低' : total < 10 ? '轻度' : total < 15 ? '中度' : '较高' }
}

import { fallbackCraftData } from '../data/craftData'
import type { AiReviewResult, CloudData } from '../types'

const cloudDataUrl =
  import.meta.env.VITE_CLOUD_DATA_URL ?? `${import.meta.env.BASE_URL}cloud/shijiang-data.json`

const asJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const fetchCraftCloudData = async (): Promise<{
  data: CloudData
  source: 'cloud' | 'fallback'
  url: string
}> => {
  try {
    const data = await fetch(cloudDataUrl, { cache: 'no-cache' }).then(asJson<CloudData>)
    return { data, source: 'cloud', url: cloudDataUrl }
  } catch {
    return { data: fallbackCraftData, source: 'fallback', url: cloudDataUrl }
  }
}

export const reviewCraftContent = (
  text: string,
  allowedKeywords: string[],
  blockedKeywords: string[],
): AiReviewResult => {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  const matched = allowedKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
  const blocked = blockedKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
  const hasProcess =
    /步骤|材料|教程|工具|制作|剪|刻|缠|绣|染|编|打磨|塑形|粘|晾|固定|组合/.test(normalized)

  if (blocked.length > 0) {
    return {
      passed: false,
      score: Math.max(8, 40 - blocked.length * 8),
      title: 'AI拦截',
      message: `检测到 ${blocked.join('、')} 等非手工内容，请删除无关信息后再提交。`,
      matched,
      blocked,
    }
  }

  const score = Math.min(98, 42 + matched.length * 10 + (hasProcess ? 20 : 0))
  const passed = score >= 68

  return {
    passed,
    score,
    title: passed ? 'AI检测通过' : '需要补充制作过程',
    message: passed
      ? '已识别到手工材料、工具或分步制作内容，可以发布。'
      : '请补充材料清单、制作步骤或传统工艺说明，系统会再次预审。',
    matched,
    blocked,
  }
}

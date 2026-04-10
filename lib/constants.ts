import { VolumeId, AnnotationCategory } from './types'

export const HSF_WORDS = [
  '爱', '安', '被', '倍', '本', '鄙', '兵', '病', '察', '朝', '曾', '乘', '诚', '除', '辞', '从',
  '殆', '当', '道', '得', '度', '非', '复', '负', '盖', '故', '顾', '固', '归', '国', '过', '何',
  '恨', '胡', '患', '或', '疾', '及', '极', '即', '计', '加', '假', '间', '见', '将', '就', '举',
  '绝', '堪', '克', '类', '怜', '临', '略', '论', '漫', '没', '靡', '明', '名', '末', '莫', '内',
  '难', '判', '平', '期', '奇', '迁', '请', '穷', '去', '劝', '却', '若', '善', '稍', '涉', '胜',
  '识', '使', '是', '适', '书', '属', '数', '率', '说', '私', '素', '汤', '涕', '通', '徒', '途',
  '推', '颓', '脱', '完', '亡', '望', '微', '文', '闻', '问', '相', '信', '行', '幸', '修', '许',
  '徐', '宣', '寻', '业', '遗', '贻', '异', '益', '阴', '因', '引', '右', '原', '远', '约', '再',
  '战', '者', '之', '制', '志', '致', '质', '治', '终', '重', '诸', '族', '卒', '坐'
]

export const VOLUME_LABELS: Record<VolumeId, string> = {
  required_1: '必修上册',
  required_2: '必修下册',
  selective_1: '选择性必修上册',
  selective_2: '选择性必修中册',
  selective_3: '选择性必修下册',
  custom: '自定义',
}

export const ANNOTATION_CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  shiCi: '实词',
  xuCi: '虚词',
  tongJia: '通假字',
  guJinYiYi: '古今异义',
  ciLeiHuoYong: '词类活用',
  teShüJuShi: '特殊句式',
  other: '其他',
}

export const KEY_FUNCTION_WORDS = [
  '之', '而', '以', '其', '于', '为', '乃', '则', '焉', '也', '者', '乎', '所', '因', '且', '若', '与', '何'
]

export const KEY_MULTI_MEANING_WORDS = [
  '兵', '道', '固', '间', '绝', '类', '论', '穷', '胜', '信', '行', '幸', '修', '徐', '遗', '益', '阴', '族'
]

export const EBBINGHAUS_INTERVALS = [1, 3, 7, 15, 30]

export function getNextReviewDate(reviewCount: number): Date {
  const days = EBBINGHAUS_INTERVALS[Math.min(reviewCount - 1, EBBINGHAUS_INTERVALS.length - 1)]
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

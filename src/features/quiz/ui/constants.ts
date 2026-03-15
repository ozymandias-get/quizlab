import {
  CheckSquare,
  XCircle,
  ListChecks,
  ArrowUpDown,
  MoreHorizontal,
  Lightbulb,
  ArrowLeftRight,
  Layers,
  Brain,
  Zap,
  Rabbit,
  LucideIcon
} from 'lucide-react'
import { ModelType, QuestionStyle } from '../model/constants'

export const STYLE_ICONS: Record<string, LucideIcon> = {
  [QuestionStyle.CLASSIC]: CheckSquare,
  [QuestionStyle.NEGATIVE]: XCircle,
  [QuestionStyle.STATEMENT]: ListChecks,
  [QuestionStyle.ORDERING]: ArrowUpDown,
  [QuestionStyle.FILL_BLANK]: MoreHorizontal,
  [QuestionStyle.REASONING]: Lightbulb,
  [QuestionStyle.MATCHING]: ArrowLeftRight,
  [QuestionStyle.MIXED]: Layers
}

export const getModelConfigs = (t: (key: string) => string) => [
  {
    type: ModelType.PRO_3_0,
    label: t('model_pro_3_0'),
    icon: Brain,
    desc: t('quiz_ai_smartest'),
    color: 'from-purple-400 to-pink-500'
  },
  {
    type: ModelType.FLASH_3_0,
    label: t('model_flash_3_0'),
    icon: Zap,
    desc: t('quiz_ai_fastest'),
    color: 'from-yellow-400 to-orange-500'
  },
  {
    type: ModelType.FLASH_2_5,
    label: t('model_flash_2_5'),
    icon: Zap,
    desc: t('quiz_ai_balanced'),
    color: 'from-cyan-400 to-blue-500'
  },
  {
    type: ModelType.LITE_2_5,
    label: t('model_lite_2_5'),
    icon: Rabbit,
    desc: t('quiz_ai_economical'),
    color: 'from-green-400 to-emerald-500'
  }
]

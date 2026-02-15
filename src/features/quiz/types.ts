import type { QuizSettings as SharedQuizSettings } from '@shared/types'

export interface QuizSettings extends SharedQuizSettings { }

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
    sourceQuote?: string;
}

export interface QuizState {
    questions: Question[];
    userAnswers: Record<string, number>;
    currentQuestionIndex: number;
    score: number;
    isFinished: boolean;
    startTime: number | null;
    endTime: number | null;
}

export const QuizStep = {
    CONFIG: 'CONFIG',
    GENERATING: 'GENERATING',
    READY: 'READY',
    QUIZ: 'QUIZ',
    RESULTS: 'RESULTS'
} as const;

export type QuizStepType = typeof QuizStep[keyof typeof QuizStep];

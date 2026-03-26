export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
}

export interface QuizQuestion {
  id: string;
  text: string;
  imageUrl?: string;
  type: QuestionType;
  options: QuizOption[];
  timeLimitSeconds: number;
  points: number;
  order: number;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  createdById: string;
  questions: QuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizSession {
  id: string;
  quizId: string;
  roomCode: string;
  status: QuizSessionStatus;
  currentQuestionIndex: number;
  startedAt?: Date;
  finishedAt?: Date;
}

export enum QuizSessionStatus {
  LOBBY = 'LOBBY',
  IN_PROGRESS = 'IN_PROGRESS',
  SHOWING_RESULTS = 'SHOWING_RESULTS',
  FINISHED = 'FINISHED',
}

export interface ParticipantResult {
  userId: string;
  username: string;
  score: number;
  rank: number;
  answers: ParticipantAnswer[];
}

export interface ParticipantAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  points: number;
  answeredAt: Date;
}

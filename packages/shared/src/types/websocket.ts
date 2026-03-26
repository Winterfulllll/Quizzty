export enum WsEvent {
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  START_QUIZ = 'start_quiz',
  NEXT_QUESTION = 'next_question',
  QUESTION_STARTED = 'question_started',
  QUESTION_ENDED = 'question_ended',
  SUBMIT_ANSWER = 'submit_answer',
  ANSWER_RESULT = 'answer_result',
  LEADERBOARD_UPDATE = 'leaderboard_update',
  QUIZ_FINISHED = 'quiz_finished',
  ERROR = 'error',
}

export interface JoinRoomPayload {
  roomCode: string;
  username: string;
}

export interface SubmitAnswerPayload {
  questionId: string;
  selectedOptionIds: string[];
}

export interface QuestionStartedPayload {
  questionIndex: number;
  question: {
    id: string;
    text: string;
    imageUrl?: string;
    type: string;
    options: { id: string; text: string }[];
    timeLimitSeconds: number;
    points: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface AnswerResultPayload {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  correctOptionIds: string[];
}

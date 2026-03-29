-- DropForeignKey
ALTER TABLE "participant_answers" DROP CONSTRAINT "participant_answers_question_id_fkey";

-- AddForeignKey
ALTER TABLE "participant_answers" ADD CONSTRAINT "participant_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

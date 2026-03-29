-- AlterTable
ALTER TABLE "quiz_sessions" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_participants" INTEGER;

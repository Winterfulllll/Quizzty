-- AlterTable: replace avatar_url (varchar) with avatar (text for base64 data URL)
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url";
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;

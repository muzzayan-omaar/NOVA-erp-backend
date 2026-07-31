-- Create new Role enum

CREATE TYPE "Role_new" AS ENUM (
  'GENERAL_MANAGER',
  'BRANCH_MANAGER',
  'CASHIER'
);


-- Remove default temporarily

ALTER TABLE "user"
ALTER COLUMN "role" DROP DEFAULT;


-- Convert existing values

ALTER TABLE "user"
ALTER COLUMN "role"
TYPE "Role_new"
USING (
  CASE
    WHEN "role" = 'OWNER'
      THEN 'GENERAL_MANAGER'::"Role_new"

    WHEN "role" = 'MANAGER'
      THEN 'BRANCH_MANAGER'::"Role_new"

    WHEN "role" = 'CASHIER'
      THEN 'CASHIER'::"Role_new"
  END
);


-- Remove old enum

DROP TYPE "Role";


-- Rename new enum

ALTER TYPE "Role_new"
RENAME TO "Role";


-- Restore default

ALTER TABLE "user"
ALTER COLUMN "role"
SET DEFAULT 'CASHIER';
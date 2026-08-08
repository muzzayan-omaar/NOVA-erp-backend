UPDATE payment
SET "verifiedById" = NULL
WHERE "verifiedById" IS NOT NULL;
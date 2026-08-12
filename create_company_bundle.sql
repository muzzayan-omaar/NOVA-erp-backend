 
CREATE TABLE "company_bundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "bundleId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_bundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_bundle_companyId_bundleId_key"
  ON "company_bundle"("companyId", "bundleId");

ALTER TABLE "company_bundle"
  ADD CONSTRAINT "company_bundle_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_bundle"
  ADD CONSTRAINT "company_bundle_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "bundle"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
-- CreateTable
CREATE TABLE "sale_payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "saleId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sale_payment" ADD CONSTRAINT "sale_payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

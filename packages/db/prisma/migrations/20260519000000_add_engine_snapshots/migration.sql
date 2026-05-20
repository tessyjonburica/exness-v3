-- CreateTable
CREATE TABLE "EngineSnapshot" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngineSnapshot_kind_key" ON "EngineSnapshot"("kind");

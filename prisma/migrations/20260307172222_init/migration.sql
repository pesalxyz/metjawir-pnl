-- CreateTable
CREATE TABLE "GeneratedCard" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "pairLabel" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "closeTimestamp" TIMESTAMP(3) NOT NULL,
    "depositUsd" DOUBLE PRECISION NOT NULL,
    "withdrawnUsd" DOUBLE PRECISION NOT NULL,
    "feesUsd" DOUBLE PRECISION NOT NULL,
    "pnlUsd" DOUBLE PRECISION NOT NULL,
    "pnlPct" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION,
    "poolAddress" TEXT,
    "positionAccount" TEXT,
    "confidence" TEXT NOT NULL,
    "warnings" JSONB NOT NULL,
    "theme" TEXT NOT NULL,
    "ratio" TEXT NOT NULL,
    "watermark" BOOLEAN NOT NULL DEFAULT true,
    "customBackgroundUrl" TEXT,
    "tokenLogoA" TEXT,
    "tokenLogoB" TEXT,
    "rawSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxCache" (
    "signature" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "parsedPayload" JSONB,
    "isMeteora" BOOLEAN,
    "positionAccount" TEXT,
    "owner" TEXT,
    "slot" BIGINT,
    "blockTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxCache_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "id" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMetadataCache" (
    "mint" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "logoUri" TEXT,
    "decimals" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMetadataCache_pkey" PRIMARY KEY ("mint")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCard_signature_key" ON "GeneratedCard"("signature");

-- CreateIndex
CREATE INDEX "PriceCache_mint_timestamp_idx" ON "PriceCache"("mint", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PriceCache_mint_timestamp_key" ON "PriceCache"("mint", "timestamp");

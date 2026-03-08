import { PrismaClient } from "@prisma/client";
import { MOCK_SIGNATURE } from "../lib/utils/mock";

const prisma = new PrismaClient();

async function main() {
  await prisma.generatedCard.upsert({
    where: { signature: MOCK_SIGNATURE },
    update: {},
    create: {
      signature: MOCK_SIGNATURE,
      owner: "6V3h9dw1vd2DQQRy6A1PM7jjYdu7hJwSPP7S4T8hC8k2",
      pairLabel: "SOL/USDC",
      protocol: "Meteora DLMM",
      closeTimestamp: new Date("2025-09-03T09:14:00.000Z"),
      depositUsd: 4200,
      withdrawnUsd: 4826.5,
      feesUsd: 186.2,
      pnlUsd: 812.7,
      pnlPct: 19.35,
      closePrice: 167.82,
      poolAddress: "9m3kYv8YBZa7d8xV1LyQhB2YuhkprbeSxA7S3JGXv1Ue",
      positionAccount: "6Lyzk4SxA9xYdC7jFkdu8z9NMPsK9b7nQ8eC8vASn6k5",
      confidence: "MEDIUM",
      warnings: ["Sample seeded data for offline UI testing."],
      theme: "aurora",
      ratio: "1:1",
      watermark: true,
      rawSummary: {
        sample: true,
        note: "Generated from seed"
      }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

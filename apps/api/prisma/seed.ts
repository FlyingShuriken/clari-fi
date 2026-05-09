import {
  AlertKind,
  ContributionAcceptanceStatus,
  ContributionKind,
  CurrencyCode,
  ExpenseProvenance,
  ExpenseSource,
  FamilyInviteStatus,
  FamilyMemberStatus,
  FamilyRole,
  ObservationSource,
  PaymentMethodType,
  PointLedgerEntryType,
  Prisma,
  ProcessingStatus,
  PromoReviewStatus,
  RewardRedemptionStatus,
  RewardType,
  SignalDecisionFilter,
  SplitAllocationType,
  SplitParticipantType,
  SplitStatus,
  StoreProvider,
  SubscriptionPlan,
  SettlementStatus,
} from "@prisma/client";
import { PrismaClient } from "@prisma/client";

function buildSeedDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    return url.toString();
  } catch {
    const separator = raw.includes("?") ? "&" : "?";
    return `${raw}${separator}pgbouncer=true&connection_limit=1`;
  }
}

const seedDatasourceUrl = buildSeedDatasourceUrl();

const prisma = new PrismaClient(
  seedDatasourceUrl
    ? {
        datasources: {
          db: {
            url: seedDatasourceUrl,
          },
        },
      }
    : undefined,
);

const DEMO_USERS = [
  {
    clerkUserId: "user_3AT9EbYugV4IirHcHRERHqTyH1e",
    email: "alvinchoi0623@gmail.com",
    displayName: "Choi JS",
  },
  {
    clerkUserId: "user_3DTErlVLyaAcaiX6zfYSCgiFkef",
    email: "alvinchoi0623.na@gmail.com",
    displayName: "Hafiz Rahman",
  },
  {
    clerkUserId: "user_3DTEuRFtf8v8kwWuxiTF3UdsCiD",
    email: "alvinchoi0623cn@gmail.com",
    displayName: "Nurul Rahman",
  },
] as const;

const DEMO_MONTH_KEY = "2026-05";
const FAMILY_NAME = "Keluarga Rahman Kuching";

const STORES = [
  {
    key: "everrise-bdc",
    displayName: "Everrise BDC",
    normalizedName: "everrise bdc",
    providerPlaceId: "demo-everrise-bdc-kuching",
    lat: 1.5151,
    lng: 110.3562,
    address: "Lot 1342, BDC, Jalan Stutong, Kuching, Sarawak",
    areaText: "BDC",
  },
  {
    key: "emart-batu-kawa",
    displayName: "Emart Batu Kawa",
    normalizedName: "emart batu kawa",
    providerPlaceId: "demo-emart-batu-kawa-kuching",
    lat: 1.5226,
    lng: 110.2913,
    address: "Batu Kawa New Township, Kuching, Sarawak",
    areaText: "Batu Kawa",
  },
  {
    key: "farley-jalan-song",
    displayName: "Farley Jalan Song",
    normalizedName: "farley jalan song",
    providerPlaceId: "demo-farley-jalan-song-kuching",
    lat: 1.5296,
    lng: 110.3604,
    address: "Jalan Song, Tabuan Heights, Kuching, Sarawak",
    areaText: "Jalan Song",
  },
  {
    key: "choice-gala-city",
    displayName: "Choice Daily Gala City",
    normalizedName: "choice daily gala city",
    providerPlaceId: "demo-choice-gala-city-kuching",
    lat: 1.5345,
    lng: 110.3649,
    address: "Gala City, Jalan Tun Jugah, Kuching, Sarawak",
    areaText: "Gala City",
  },
  {
    key: "petronas-pending",
    displayName: "Petronas Pending",
    normalizedName: "petronas pending",
    providerPlaceId: "demo-petronas-pending-kuching",
    lat: 1.5539,
    lng: 110.3888,
    address: "Jalan Pending, Kuching, Sarawak",
    areaText: "Pending",
  },
  {
    key: "aeon-vivacity",
    displayName: "AEON Vivacity Megamall",
    normalizedName: "aeon vivacity megamall",
    providerPlaceId: "demo-aeon-vivacity-kuching",
    lat: 1.5317,
    lng: 110.3578,
    address: "Vivacity Megamall, Jalan Wan Alwi, Kuching, Sarawak",
    areaText: "Jalan Wan Alwi",
  },
] as const;

const CANONICAL_ITEMS = [
  {
    canonicalName: "rice 5kg",
    canonicalUnit: "5kg",
    category: "groceries",
    aliases: ["beras 5kg", "jasmine rice 5kg", "beras jasmine 5kg"],
  },
  {
    canonicalName: "cooking oil 5kg",
    canonicalUnit: "5kg",
    category: "groceries",
    aliases: ["minyak masak 5kg", "cooking oil", "minyak 5kg"],
  },
  {
    canonicalName: "eggs grade c 30",
    canonicalUnit: "30pcs",
    category: "groceries",
    aliases: ["telur gred c 30", "eggs 30 tray", "tray eggs 30"],
  },
  {
    canonicalName: "fresh milk 1l",
    canonicalUnit: "1l",
    category: "groceries",
    aliases: ["milk 1l", "susu segar 1l", "full cream milk 1l"],
  },
  {
    canonicalName: "chicken breast",
    canonicalUnit: "kg",
    category: "groceries",
    aliases: ["fresh chicken breast", "isi ayam", "ayam dada"],
  },
  {
    canonicalName: "yellow onion",
    canonicalUnit: "kg",
    category: "groceries",
    aliases: ["onion 1kg", "bawang holland", "yellow onion 1kg"],
  },
  {
    canonicalName: "garlic",
    canonicalUnit: "500g",
    category: "groceries",
    aliases: ["garlic 500g", "bawang putih", "garlic pack"],
  },
  {
    canonicalName: "milo 1kg",
    canonicalUnit: "1kg",
    category: "groceries",
    aliases: ["milo refill 1kg", "milo pack 1kg", "milo"],
  },
  {
    canonicalName: "detergent 2.3kg",
    canonicalUnit: "2.3kg",
    category: "household",
    aliases: ["laundry detergent 2.3kg", "sabun baju 2.3kg", "detergent pack"],
  },
] as const;

const REWARD_CATALOG = [
  {
    code: "voucher-rm5",
    title: "RM5 Grocery Voucher",
    description: "Mock Kuching grocery voucher for pitch demos.",
    type: RewardType.VOUCHER,
    pointsCost: 60,
    metadata: { partner: "Everrise Demo", faceValueRm: 5 },
  },
  {
    code: "partner-discount-10",
    title: "10% Partner Discount",
    description: "Mock partner discount for Sarawak household staples.",
    type: RewardType.PARTNER_DISCOUNT,
    pointsCost: 90,
    metadata: { partner: "Emart Demo", discountPct: 10 },
  },
  {
    code: "exclusive-promo-early",
    title: "Exclusive Promo Unlock",
    description: "Early-access mock promo for premium families in Kuching.",
    type: RewardType.EXCLUSIVE_PROMOTION,
    pointsCost: 120,
    metadata: { promoCode: "KCH-EARLY" },
  },
] as const;

type SeedUserMap = Record<
  (typeof DEMO_USERS)[number]["clerkUserId"],
  { id: string; displayName: string }
>;
type StoreMap = Record<
  (typeof STORES)[number]["key"],
  {
    id: string;
    areaText: string;
    displayName: string;
    lat: number;
    lng: number;
  }
>;
type ItemMap = Record<
  (typeof CANONICAL_ITEMS)[number]["canonicalName"],
  { id: string; canonicalUnit: string | null }
>;

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function decimalQty(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(4));
}

function dayAt(isoDate: string, hour: number, minute = 0): Date {
  const stamp = `${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  return new Date(stamp);
}

async function resetDemoUsers() {
  await prisma.user.deleteMany({
    where: {
      clerkUserId: {
        in: DEMO_USERS.map((user) => user.clerkUserId),
      },
    },
  });
}

async function seedUsers(): Promise<SeedUserMap> {
  const seeded = [];
  for (const user of DEMO_USERS) {
    seeded.push(
      await prisma.user.create({
        data: {
          clerkUserId: user.clerkUserId,
          email: user.email,
          displayName: user.displayName,
          locale: "en-MY",
          timezone: "Asia/Kuching",
        },
        select: {
          id: true,
          clerkUserId: true,
          displayName: true,
        },
      }),
    );
  }

  return seeded.reduce<SeedUserMap>((acc, user) => {
    acc[user.clerkUserId as keyof SeedUserMap] = {
      id: user.id,
      displayName: user.displayName ?? user.clerkUserId,
    };
    return acc;
  }, {} as SeedUserMap);
}

async function seedStores(): Promise<StoreMap> {
  const rows = [];
  for (const store of STORES) {
    rows.push(
      await prisma.store.upsert({
        where: {
          provider_providerPlaceId: {
            provider: StoreProvider.OSM_NOMINATIM,
            providerPlaceId: store.providerPlaceId,
          },
        },
        update: {
          displayName: store.displayName,
          normalizedName: store.normalizedName,
          lat: decimalQty(store.lat),
          lng: decimalQty(store.lng),
          address: store.address,
        },
        create: {
          displayName: store.displayName,
          normalizedName: store.normalizedName,
          provider: StoreProvider.OSM_NOMINATIM,
          providerPlaceId: store.providerPlaceId,
          lat: decimalQty(store.lat),
          lng: decimalQty(store.lng),
          address: store.address,
        },
        select: {
          id: true,
          displayName: true,
        },
      }),
    );
  }

  return rows.reduce<StoreMap>((acc, row, index) => {
    const source = STORES[index];
    acc[source.key] = {
      id: row.id,
      areaText: source.areaText,
      displayName: row.displayName,
      lat: source.lat,
      lng: source.lng,
    };
    return acc;
  }, {} as StoreMap);
}

async function seedCanonicalItems(): Promise<ItemMap> {
  const rows = [];
  for (const item of CANONICAL_ITEMS) {
      const canonical = await prisma.canonicalItem.upsert({
        where: { canonicalName: item.canonicalName },
        update: {
          canonicalUnit: item.canonicalUnit,
          category: item.category,
        },
        create: {
          canonicalName: item.canonicalName,
          canonicalUnit: item.canonicalUnit,
          category: item.category,
        },
        select: {
          id: true,
          canonicalName: true,
          canonicalUnit: true,
        },
      });

      for (const aliasText of item.aliases) {
        await prisma.itemAlias.upsert({
          where: {
            aliasText_locale: {
              aliasText,
              locale: "en-MY",
            },
          },
          update: {
            canonicalItemId: canonical.id,
          },
          create: {
            canonicalItemId: canonical.id,
            aliasText,
            locale: "en-MY",
          },
        });
      }

      rows.push(canonical);
  }

  return rows.reduce<ItemMap>((acc, row) => {
    acc[row.canonicalName as keyof ItemMap] = {
      id: row.id,
      canonicalUnit: row.canonicalUnit,
    };
    return acc;
  }, {} as ItemMap);
}

async function seedFamily(users: SeedUserMap) {
  const family = await prisma.familyProfile.create({
    data: {
      name: FAMILY_NAME,
      createdByUserId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
      members: {
        create: [
          {
            userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
            role: FamilyRole.OWNER,
            status: FamilyMemberStatus.ACTIVE,
            joinedAt: dayAt("2026-03-28", 9),
          },
          {
            userId: users["user_3DTErlVLyaAcaiX6zfYSCgiFkef"].id,
            role: FamilyRole.EDITOR,
            status: FamilyMemberStatus.ACTIVE,
            joinedAt: dayAt("2026-03-28", 10),
          },
          {
            userId: users["user_3DTEuRFtf8v8kwWuxiTF3UdsCiD"].id,
            role: FamilyRole.VIEWER,
            status: FamilyMemberStatus.ACTIVE,
            joinedAt: dayAt("2026-03-29", 11),
          },
        ],
      },
      invites: {
        create: [
          {
            code: "KCHDEMO1",
            createdByUserId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
            status: FamilyInviteStatus.ACTIVE,
            expiresAt: dayAt("2026-05-18", 23, 59),
          },
        ],
      },
    },
    include: {
      members: true,
    },
  });

  return {
    id: family.id,
    members: family.members.reduce<Record<string, string>>((acc, member) => {
      acc[member.userId] = member.id;
      return acc;
    }, {}),
  };
}

async function seedSubscriptions(users: SeedUserMap) {
  await prisma.userSubscription.create({
    data: {
      userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
      plan: SubscriptionPlan.PREMIUM,
      addonCount: 1,
    },
  });

  await prisma.userSubscription.create({
    data: {
      userId: users["user_3DTErlVLyaAcaiX6zfYSCgiFkef"].id,
      plan: SubscriptionPlan.FREE,
      addonCount: 0,
    },
  });

  await prisma.userSubscription.create({
    data: {
      userId: users["user_3DTEuRFtf8v8kwWuxiTF3UdsCiD"].id,
      plan: SubscriptionPlan.FREE,
      addonCount: 0,
    },
  });

  await prisma.subscriptionUsageMonth.create({
    data: {
      userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
      periodKey: DEMO_MONTH_KEY,
      compareSearchCount: 7,
    },
  });
}

type ReceiptItemInput = {
  descriptionRaw: string;
  canonicalName?: (typeof CANONICAL_ITEMS)[number]["canonicalName"];
  quantity?: number;
  unitRaw?: string;
  unitPrice?: number;
  totalPrice: number;
  confidence?: number;
};

async function createReceiptExpense(args: {
  userId: string;
  familyId?: string;
  storeId: string;
  merchantText: string;
  areaText: string;
  lat: number;
  lng: number;
  transactionAt: Date;
  paymentMethod: PaymentMethodType;
  note?: string;
  items: ReceiptItemInput[];
  receiptFileRef: string;
  itemMap: ItemMap;
}) {
  const totalAmount = args.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const created = await prisma.expense.create({
    data: {
      userId: args.userId,
      familyId: args.familyId,
      source: ExpenseSource.RECEIPT,
      provenance: ExpenseProvenance.RECEIPT_OCR,
      currency: CurrencyCode.MYR,
      totalAmount: decimal(totalAmount),
      merchantText: args.merchantText,
      paymentMethod: args.paymentMethod,
      transactionAt: args.transactionAt,
      locationLat: decimalQty(args.lat),
      locationLng: decimalQty(args.lng),
      areaText: args.areaText,
      note: args.note,
      confidence: new Prisma.Decimal("0.9600"),
      parseLatencyMs: 1340,
      rawPayload: {
        seed: "kuching-demo",
        merchant: args.merchantText,
      } satisfies Prisma.InputJsonValue,
      lineItems: {
        create: args.items.map((item) => ({
          descriptionRaw: item.descriptionRaw,
          quantity:
            typeof item.quantity === "number"
              ? decimalQty(item.quantity)
              : undefined,
          unitRaw: item.unitRaw,
          unitPrice:
            typeof item.unitPrice === "number"
              ? decimal(item.unitPrice)
              : undefined,
          totalPrice: decimal(item.totalPrice),
          currency: CurrencyCode.MYR,
          confidence: new Prisma.Decimal((item.confidence ?? 0.92).toFixed(4)),
        })),
      },
      receipt: {
        create: {
          userId: args.userId,
          fileRef: args.receiptFileRef,
          mimeType: "image/jpeg",
          ocrStatus: ProcessingStatus.COMPLETED,
          confidence: new Prisma.Decimal("0.9500"),
          ocrRaw: {
            seed: true,
            merchant: args.merchantText,
          } satisfies Prisma.InputJsonValue,
          parsedPayload: {
            merchantText: args.merchantText,
            totalAmount,
            lineItems: args.items,
          } satisfies Prisma.InputJsonValue,
          capturedAt: args.transactionAt,
        },
      },
    },
    include: {
      lineItems: true,
      receipt: true,
    },
  });

  for (const [index, lineItem] of created.lineItems.entries()) {
      const source = args.items[index];
      if (!source.canonicalName) {
        continue;
      }
      const canonicalItemId = args.itemMap[source.canonicalName].id;
      const unitPrice =
        typeof source.unitPrice === "number"
          ? source.unitPrice
          : source.quantity && source.quantity > 0
            ? source.totalPrice / source.quantity
            : source.totalPrice;

      await prisma.priceObservation.create({
        data: {
          userId: args.userId,
          expenseId: created.id,
          expenseLineItemId: lineItem.id,
          canonicalItemId,
          storeId: args.storeId,
          areaText: args.areaText,
          currency: CurrencyCode.MYR,
          quantity:
            typeof source.quantity === "number"
              ? decimalQty(source.quantity)
              : undefined,
          unitRaw: source.unitRaw,
          unitPrice: decimal(unitPrice),
          totalPrice: decimal(source.totalPrice),
          observedAt: args.transactionAt,
          provenance: ExpenseProvenance.RECEIPT_OCR,
          trustScore: new Prisma.Decimal("0.9100"),
          outlierFlag: false,
          metadata: {
            seed: "kuching-demo",
            merchant: args.merchantText,
            receiptFileRef: args.receiptFileRef,
          } satisfies Prisma.InputJsonValue,
        },
      });
  }

  return created;
}

async function createManualExpense(args: {
  userId: string;
  familyId?: string;
  merchantText: string;
  areaText: string;
  lat?: number;
  lng?: number;
  transactionAt: Date;
  paymentMethod: PaymentMethodType;
  note?: string;
  items: Array<{
    descriptionRaw: string;
    quantity?: number;
    unitRaw?: string;
    unitPrice?: number;
    totalPrice: number;
  }>;
}) {
  const totalAmount = args.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  return prisma.expense.create({
    data: {
      userId: args.userId,
      familyId: args.familyId,
      source: ExpenseSource.MANUAL,
      provenance: ExpenseProvenance.MANUAL,
      currency: CurrencyCode.MYR,
      totalAmount: decimal(totalAmount),
      merchantText: args.merchantText,
      paymentMethod: args.paymentMethod,
      transactionAt: args.transactionAt,
      locationLat:
        typeof args.lat === "number" ? decimalQty(args.lat) : undefined,
      locationLng:
        typeof args.lng === "number" ? decimalQty(args.lng) : undefined,
      areaText: args.areaText,
      note: args.note,
      confidence: new Prisma.Decimal("0.8800"),
      lineItems: {
        create: args.items.map((item) => ({
          descriptionRaw: item.descriptionRaw,
          quantity:
            typeof item.quantity === "number"
              ? decimalQty(item.quantity)
              : undefined,
          unitRaw: item.unitRaw,
          unitPrice:
            typeof item.unitPrice === "number"
              ? decimal(item.unitPrice)
              : undefined,
          totalPrice: decimal(item.totalPrice),
          currency: CurrencyCode.MYR,
          confidence: new Prisma.Decimal("0.8600"),
        })),
      },
    },
  });
}

async function createContributionReceipt(args: {
  userId: string;
  expenseId: string;
  receiptId: string;
  acceptedAt: Date;
  description: string;
  points: number;
  kind: PointLedgerEntryType;
  streakBonusPoints?: number;
}) {
  const submission = await prisma.contributionSubmission.create({
    data: {
      userId: args.userId,
      kind: ContributionKind.RECEIPT,
      sourceRef: args.expenseId,
      fingerprint: `receipt-${args.expenseId}`,
      receiptId: args.receiptId,
      structuredItemCount: 4,
      metadata: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: args.acceptedAt,
      updatedAt: args.acceptedAt,
    },
  });

  const acceptance = await prisma.contributionAcceptance.create({
    data: {
      submissionId: submission.id,
      userId: args.userId,
      status: ContributionAcceptanceStatus.ACCEPTED,
      basePoints: args.points,
      bonusPoints: 0,
      totalPoints: args.points,
      streakDays: 1,
      acceptedAt: args.acceptedAt,
      metadata: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: args.acceptedAt,
      updatedAt: args.acceptedAt,
    },
  });

  await prisma.pointLedgerEntry.create({
    data: {
      userId: args.userId,
      acceptanceId: acceptance.id,
      type: args.kind,
      pointsDelta: args.points,
      description: args.description,
      createdAt: args.acceptedAt,
    },
  });

  if (args.streakBonusPoints && args.streakBonusPoints > 0) {
    await prisma.pointLedgerEntry.create({
      data: {
        userId: args.userId,
        acceptanceId: acceptance.id,
        type: PointLedgerEntryType.STREAK_BONUS,
        pointsDelta: args.streakBonusPoints,
        description: "7-day contribution streak bonus",
        createdAt: args.acceptedAt,
      },
    });
  }
}

async function createContributionFlyer(args: {
  userId: string;
  promoIngestionId: string;
  acceptedAt: Date;
  description: string;
  points: number;
}) {
  const submission = await prisma.contributionSubmission.create({
    data: {
      userId: args.userId,
      kind: ContributionKind.FLYER,
      sourceRef: args.promoIngestionId,
      fingerprint: `flyer-${args.promoIngestionId}`,
      promoIngestionId: args.promoIngestionId,
      structuredItemCount: 3,
      metadata: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: args.acceptedAt,
      updatedAt: args.acceptedAt,
    },
  });

  const acceptance = await prisma.contributionAcceptance.create({
    data: {
      submissionId: submission.id,
      userId: args.userId,
      status: ContributionAcceptanceStatus.ACCEPTED,
      basePoints: args.points,
      bonusPoints: 0,
      totalPoints: args.points,
      streakDays: 1,
      acceptedAt: args.acceptedAt,
      metadata: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: args.acceptedAt,
      updatedAt: args.acceptedAt,
    },
  });

  await prisma.pointLedgerEntry.create({
    data: {
      userId: args.userId,
      acceptanceId: acceptance.id,
      type: PointLedgerEntryType.FLYER_ACCEPTED,
      pointsDelta: args.points,
      description: args.description,
      createdAt: args.acceptedAt,
    },
  });
}

async function seedRewards(users: SeedUserMap) {
  const catalog = [];
  for (const item of REWARD_CATALOG) {
    catalog.push(
      await prisma.rewardCatalogItem.upsert({
        where: { code: item.code },
        update: {
          title: item.title,
          description: item.description,
          type: item.type,
          pointsCost: item.pointsCost,
          active: true,
          metadata: item.metadata,
        },
        create: {
          code: item.code,
          title: item.title,
          description: item.description,
          type: item.type,
          pointsCost: item.pointsCost,
          active: true,
          metadata: item.metadata,
        },
      }),
    );
  }

  const voucher = catalog.find((item) => item.code === "voucher-rm5");
  if (!voucher) {
    throw new Error("Reward catalog seeding failed.");
  }

  const redemptionAt = dayAt("2026-05-02", 14, 15);
  const redemption = await prisma.rewardRedemption.create({
    data: {
      userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
      rewardId: voucher.id,
      status: RewardRedemptionStatus.FULFILLED,
      pointsCost: voucher.pointsCost,
      fulfilledAt: redemptionAt,
      metadata: {
        seed: "kuching-demo",
        rewardCode: voucher.code,
      } satisfies Prisma.InputJsonValue,
      createdAt: redemptionAt,
      updatedAt: redemptionAt,
    },
  });

  await prisma.pointLedgerEntry.create({
    data: {
      userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
      redemptionId: redemption.id,
      type: PointLedgerEntryType.REDEMPTION,
      pointsDelta: -voucher.pointsCost,
      description: `Redeemed ${voucher.title}`,
      createdAt: redemptionAt,
    },
  });
}

async function seedPromos(args: {
  userId: string;
  stores: StoreMap;
  items: ItemMap;
}) {
  const everrisePromo = await prisma.promoIngestion.create({
    data: {
      userId: args.userId,
      fileRef: "seed://promo/everrise-bdc-weekend-savers.jpg",
      mimeType: "image/jpeg",
      merchantText: "Everrise BDC",
      areaText: "BDC",
      status: ProcessingStatus.COMPLETED,
      rawText: "Weekend Savers",
      parsedPayload: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: dayAt("2026-05-06", 8),
      updatedAt: dayAt("2026-05-06", 8),
    },
  });

  await prisma.promoObservation.createMany({
    data: [
      {
        ingestionId: everrisePromo.id,
        userId: args.userId,
        canonicalItemId: args.items["rice 5kg"].id,
        storeId: args.stores["everrise-bdc"].id,
        areaText: "BDC",
        currency: CurrencyCode.MYR,
        quantity: decimalQty(1),
        unitRaw: "5kg",
        unitPrice: decimal(29.9),
        totalPrice: decimal(29.9),
        trustScore: new Prisma.Decimal("0.8900"),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: dayAt("2026-05-06", 8),
        validFrom: dayAt("2026-05-07", 0),
        validTo: dayAt("2026-05-12", 23),
        metadata: {
          promoText: "Weekend Savers",
        } satisfies Prisma.InputJsonValue,
      },
      {
        ingestionId: everrisePromo.id,
        userId: args.userId,
        canonicalItemId: args.items["eggs grade c 30"].id,
        storeId: args.stores["everrise-bdc"].id,
        areaText: "BDC",
        currency: CurrencyCode.MYR,
        quantity: decimalQty(1),
        unitRaw: "30pcs",
        unitPrice: decimal(11.9),
        totalPrice: decimal(11.9),
        trustScore: new Prisma.Decimal("0.9000"),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: dayAt("2026-05-06", 8),
        validFrom: dayAt("2026-05-07", 0),
        validTo: dayAt("2026-05-12", 23),
        metadata: {
          promoText: "Weekend Savers",
        } satisfies Prisma.InputJsonValue,
      },
      {
        ingestionId: everrisePromo.id,
        userId: args.userId,
        canonicalItemId: args.items["fresh milk 1l"].id,
        storeId: args.stores["everrise-bdc"].id,
        areaText: "BDC",
        currency: CurrencyCode.MYR,
        quantity: decimalQty(1),
        unitRaw: "1l",
        unitPrice: decimal(6.79),
        totalPrice: decimal(6.79),
        trustScore: new Prisma.Decimal("0.8800"),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: dayAt("2026-05-06", 8),
        validFrom: dayAt("2026-05-07", 0),
        validTo: dayAt("2026-05-12", 23),
        metadata: {
          promoText: "Weekend Savers",
        } satisfies Prisma.InputJsonValue,
      },
    ],
  });

  const emartPromo = await prisma.promoIngestion.create({
    data: {
      userId: args.userId,
      fileRef: "seed://promo/emart-batu-kawa-rollbacks.jpg",
      mimeType: "image/jpeg",
      merchantText: "Emart Batu Kawa",
      areaText: "Batu Kawa",
      status: ProcessingStatus.COMPLETED,
      rawText: "Weekend Rollbacks",
      parsedPayload: {
        seed: "kuching-demo",
      } satisfies Prisma.InputJsonValue,
      createdAt: dayAt("2026-05-08", 9),
      updatedAt: dayAt("2026-05-08", 9),
    },
  });

  await prisma.promoObservation.createMany({
    data: [
      {
        ingestionId: emartPromo.id,
        userId: args.userId,
        canonicalItemId: args.items["cooking oil 5kg"].id,
        storeId: args.stores["emart-batu-kawa"].id,
        areaText: "Batu Kawa",
        currency: CurrencyCode.MYR,
        quantity: decimalQty(1),
        unitRaw: "5kg",
        unitPrice: decimal(30.49),
        totalPrice: decimal(30.49),
        trustScore: new Prisma.Decimal("0.9200"),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: dayAt("2026-05-08", 9),
        validFrom: dayAt("2026-05-09", 0),
        validTo: dayAt("2026-05-11", 23),
        metadata: {
          promoText: "Weekend Rollbacks",
        } satisfies Prisma.InputJsonValue,
      },
      {
        ingestionId: emartPromo.id,
        userId: args.userId,
        canonicalItemId: args.items["milo 1kg"].id,
        storeId: args.stores["emart-batu-kawa"].id,
        areaText: "Batu Kawa",
        currency: CurrencyCode.MYR,
        quantity: decimalQty(1),
        unitRaw: "1kg",
        unitPrice: decimal(16.9),
        totalPrice: decimal(16.9),
        trustScore: new Prisma.Decimal("0.8900"),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: dayAt("2026-05-08", 9),
        validFrom: dayAt("2026-05-09", 0),
        validTo: dayAt("2026-05-11", 23),
        metadata: {
          promoText: "Weekend Rollbacks",
        } satisfies Prisma.InputJsonValue,
      },
    ],
  });

  await createContributionFlyer({
    userId: args.userId,
    promoIngestionId: everrisePromo.id,
    acceptedAt: dayAt("2026-05-06", 11),
    description: "Accepted flyer contribution from Everrise BDC",
    points: 10,
  });

  await createContributionFlyer({
    userId: args.userId,
    promoIngestionId: emartPromo.id,
    acceptedAt: dayAt("2026-05-08", 11),
    description: "Accepted flyer contribution from Emart Batu Kawa",
    points: 10,
  });
}

async function seedHouseholdData(args: {
  users: SeedUserMap;
  family: { id: string; members: Record<string, string> };
  stores: StoreMap;
  items: ItemMap;
}) {
  const ownerId = args.users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id;
  const spouseId = args.users["user_3DTErlVLyaAcaiX6zfYSCgiFkef"].id;
  const sisterId = args.users["user_3DTEuRFtf8v8kwWuxiTF3UdsCiD"].id;

  const groceryPlan = [
    {
      date: "2026-04-10",
      hour: 18,
      userId: ownerId,
      storeKey: "everrise-bdc" as const,
      items: [
        {
          descriptionRaw: "Beras Jasmine 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 34.9,
          totalPrice: 34.9,
        },
        {
          descriptionRaw: "Minyak Masak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 33.5,
          totalPrice: 33.5,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 13.4,
          totalPrice: 13.4,
        },
        {
          descriptionRaw: "Fresh Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.5,
          totalPrice: 7.5,
        },
        {
          descriptionRaw: "Isi Ayam",
          canonicalName: "chicken breast" as const,
          quantity: 1.1,
          unitRaw: "kg",
          unitPrice: 18.2,
          totalPrice: 20.02,
        },
      ],
    },
    {
      date: "2026-04-12",
      hour: 17,
      userId: spouseId,
      storeKey: "emart-batu-kawa" as const,
      items: [
        {
          descriptionRaw: "Beras 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 33.8,
          totalPrice: 33.8,
        },
        {
          descriptionRaw: "Cooking Oil 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.9,
          totalPrice: 32.9,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 13.1,
          totalPrice: 13.1,
        },
        {
          descriptionRaw: "Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.35,
          totalPrice: 7.35,
        },
        {
          descriptionRaw: "Yellow Onion 1kg",
          canonicalName: "yellow onion" as const,
          quantity: 1,
          unitRaw: "kg",
          unitPrice: 4.8,
          totalPrice: 4.8,
        },
      ],
    },
    {
      date: "2026-04-15",
      hour: 19,
      userId: ownerId,
      storeKey: "farley-jalan-song" as const,
      items: [
        {
          descriptionRaw: "Jasmine Rice 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 33.3,
          totalPrice: 33.3,
        },
        {
          descriptionRaw: "Minyak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.7,
          totalPrice: 32.7,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.8,
          totalPrice: 12.8,
        },
        {
          descriptionRaw: "Susu Segar 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.29,
          totalPrice: 7.29,
        },
        {
          descriptionRaw: "Garlic 500g",
          canonicalName: "garlic" as const,
          quantity: 1,
          unitRaw: "500g",
          unitPrice: 5.1,
          totalPrice: 5.1,
        },
      ],
    },
    {
      date: "2026-04-18",
      hour: 18,
      userId: ownerId,
      storeKey: "choice-gala-city" as const,
      items: [
        {
          descriptionRaw: "Beras Jasmine 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 34.5,
          totalPrice: 34.5,
        },
        {
          descriptionRaw: "Cooking Oil 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 33.1,
          totalPrice: 33.1,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 13.2,
          totalPrice: 13.2,
        },
        {
          descriptionRaw: "Full Cream Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.39,
          totalPrice: 7.39,
        },
        {
          descriptionRaw: "Milo Refill 1kg",
          canonicalName: "milo 1kg" as const,
          quantity: 1,
          unitRaw: "1kg",
          unitPrice: 18.4,
          totalPrice: 18.4,
        },
      ],
    },
    {
      date: "2026-04-21",
      hour: 16,
      userId: spouseId,
      storeKey: "everrise-bdc" as const,
      items: [
        {
          descriptionRaw: "Beras 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 33.4,
          totalPrice: 33.4,
        },
        {
          descriptionRaw: "Minyak Masak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.8,
          totalPrice: 32.8,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.9,
          totalPrice: 12.9,
        },
        {
          descriptionRaw: "Fresh Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.15,
          totalPrice: 7.15,
        },
        {
          descriptionRaw: "Laundry Detergent 2.3kg",
          canonicalName: "detergent 2.3kg" as const,
          quantity: 1,
          unitRaw: "2.3kg",
          unitPrice: 23.9,
          totalPrice: 23.9,
        },
      ],
    },
    {
      date: "2026-04-24",
      hour: 18,
      userId: ownerId,
      storeKey: "emart-batu-kawa" as const,
      items: [
        {
          descriptionRaw: "Jasmine Rice 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.9,
          totalPrice: 32.9,
        },
        {
          descriptionRaw: "Cooking Oil 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.9,
          totalPrice: 31.9,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.7,
          totalPrice: 12.7,
        },
        {
          descriptionRaw: "Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 7.05,
          totalPrice: 7.05,
        },
        {
          descriptionRaw: "Fresh Chicken Breast",
          canonicalName: "chicken breast" as const,
          quantity: 1.2,
          unitRaw: "kg",
          unitPrice: 17.9,
          totalPrice: 21.48,
        },
      ],
    },
    {
      date: "2026-04-27",
      hour: 18,
      userId: ownerId,
      storeKey: "farley-jalan-song" as const,
      items: [
        {
          descriptionRaw: "Beras Jasmine 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.6,
          totalPrice: 32.6,
        },
        {
          descriptionRaw: "Minyak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.8,
          totalPrice: 31.8,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.6,
          totalPrice: 12.6,
        },
        {
          descriptionRaw: "Susu Segar 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.99,
          totalPrice: 6.99,
        },
        {
          descriptionRaw: "Milo Pack 1kg",
          canonicalName: "milo 1kg" as const,
          quantity: 1,
          unitRaw: "1kg",
          unitPrice: 17.8,
          totalPrice: 17.8,
        },
      ],
    },
    {
      date: "2026-04-30",
      hour: 18,
      userId: spouseId,
      storeKey: "choice-gala-city" as const,
      items: [
        {
          descriptionRaw: "Beras 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.4,
          totalPrice: 32.4,
        },
        {
          descriptionRaw: "Minyak Masak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.7,
          totalPrice: 31.7,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.5,
          totalPrice: 12.5,
        },
        {
          descriptionRaw: "Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.95,
          totalPrice: 6.95,
        },
        {
          descriptionRaw: "Yellow Onion 1kg",
          canonicalName: "yellow onion" as const,
          quantity: 1,
          unitRaw: "kg",
          unitPrice: 4.4,
          totalPrice: 4.4,
        },
      ],
    },
    {
      date: "2026-05-02",
      hour: 17,
      userId: ownerId,
      storeKey: "everrise-bdc" as const,
      items: [
        {
          descriptionRaw: "Jasmine Rice 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 32.2,
          totalPrice: 32.2,
        },
        {
          descriptionRaw: "Cooking Oil 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.4,
          totalPrice: 31.4,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.4,
          totalPrice: 12.4,
        },
        {
          descriptionRaw: "Fresh Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.9,
          totalPrice: 6.9,
        },
        {
          descriptionRaw: "Garlic Pack",
          canonicalName: "garlic" as const,
          quantity: 1,
          unitRaw: "500g",
          unitPrice: 4.8,
          totalPrice: 4.8,
        },
      ],
    },
    {
      date: "2026-05-04",
      hour: 18,
      userId: spouseId,
      storeKey: "emart-batu-kawa" as const,
      items: [
        {
          descriptionRaw: "Beras 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.9,
          totalPrice: 31.9,
        },
        {
          descriptionRaw: "Minyak Masak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.2,
          totalPrice: 31.2,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.2,
          totalPrice: 12.2,
        },
        {
          descriptionRaw: "Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.85,
          totalPrice: 6.85,
        },
        {
          descriptionRaw: "Laundry Detergent 2.3kg",
          canonicalName: "detergent 2.3kg" as const,
          quantity: 1,
          unitRaw: "2.3kg",
          unitPrice: 22.9,
          totalPrice: 22.9,
        },
      ],
    },
    {
      date: "2026-05-06",
      hour: 19,
      userId: ownerId,
      storeKey: "farley-jalan-song" as const,
      items: [
        {
          descriptionRaw: "Jasmine Rice 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.7,
          totalPrice: 31.7,
        },
        {
          descriptionRaw: "Cooking Oil 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.0,
          totalPrice: 31.0,
        },
        {
          descriptionRaw: "Telur Gred C 30",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 12.1,
          totalPrice: 12.1,
        },
        {
          descriptionRaw: "Susu Segar 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.8,
          totalPrice: 6.8,
        },
        {
          descriptionRaw: "Fresh Chicken Breast",
          canonicalName: "chicken breast" as const,
          quantity: 1.3,
          unitRaw: "kg",
          unitPrice: 17.2,
          totalPrice: 22.36,
        },
      ],
    },
    {
      date: "2026-05-08",
      hour: 18,
      userId: ownerId,
      storeKey: "emart-batu-kawa" as const,
      items: [
        {
          descriptionRaw: "Beras 5kg",
          canonicalName: "rice 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 31.3,
          totalPrice: 31.3,
        },
        {
          descriptionRaw: "Minyak Masak 5kg",
          canonicalName: "cooking oil 5kg" as const,
          quantity: 1,
          unitRaw: "5kg",
          unitPrice: 30.9,
          totalPrice: 30.9,
        },
        {
          descriptionRaw: "Eggs 30 Tray",
          canonicalName: "eggs grade c 30" as const,
          quantity: 1,
          unitRaw: "30pcs",
          unitPrice: 11.95,
          totalPrice: 11.95,
        },
        {
          descriptionRaw: "Milk 1L",
          canonicalName: "fresh milk 1l" as const,
          quantity: 1,
          unitRaw: "1l",
          unitPrice: 6.75,
          totalPrice: 6.75,
        },
        {
          descriptionRaw: "Milo Refill 1kg",
          canonicalName: "milo 1kg" as const,
          quantity: 1,
          unitRaw: "1kg",
          unitPrice: 17.1,
          totalPrice: 17.1,
        },
      ],
    },
  ];

  const createdGroceryExpenses = [];
  for (let index = 0; index < groceryPlan.length; index += 1) {
    const trip = groceryPlan[index];
    const store = args.stores[trip.storeKey];
    const expense = await createReceiptExpense({
      userId: trip.userId,
      familyId: args.family.id,
      storeId: store.id,
      merchantText: store.displayName,
      areaText: store.areaText,
      lat: store.lat,
      lng: store.lng,
      transactionAt: dayAt(trip.date, trip.hour),
      paymentMethod: PaymentMethodType.DUITNOW,
      note: "Weekly grocery restock for household demo data.",
      items: trip.items,
      receiptFileRef: `seed://receipt/${trip.storeKey}/${index + 1}.jpg`,
      itemMap: args.items,
    });
    createdGroceryExpenses.push(expense);
  }

  const receiptContributionIndexes = [0, 1, 2, 4, 5, 7, 8, 10, 11];
  for (const [position, expenseIndex] of receiptContributionIndexes.entries()) {
    const expense = createdGroceryExpenses[expenseIndex];
    if (!expense?.receipt?.id) {
      continue;
    }
    const acceptedAt = new Date(
      expense.transactionAt.getTime() + 2 * 60 * 60 * 1000,
    );
    await createContributionReceipt({
      userId: ownerId,
      expenseId: expense.id,
      receiptId: expense.receipt.id,
      acceptedAt,
      description: `Accepted receipt contribution from ${expense.merchantText ?? "Kuching store"}`,
      points: 8,
      kind: PointLedgerEntryType.RECEIPT_ACCEPTED,
      streakBonusPoints:
        position === receiptContributionIndexes.length - 1 ? 15 : undefined,
    });
  }

  const petrolRefillPlan = [
    {
      userId: ownerId,
      merchantText: "Petronas Pending",
      areaText: "Pending",
      lat: 1.5539,
      lng: 110.3888,
      transactionAt: dayAt("2026-04-14", 8, 20),
      paymentMethod: PaymentMethodType.CARD,
      note: "School run and office commute fuel.",
      litres: 32,
      totalPrice: 65.6,
    },
    {
      userId: ownerId,
      merchantText: "Shell Jalan Song",
      areaText: "Jalan Song",
      lat: 1.5291,
      lng: 110.3609,
      transactionAt: dayAt("2026-04-29", 18, 10),
      paymentMethod: PaymentMethodType.TNG,
      note: "Midweek refill after Tabuan and school errands.",
      litres: 35,
      totalPrice: 71.75,
    },
    {
      userId: ownerId,
      merchantText: "Petronas Satok",
      areaText: "Satok",
      lat: 1.5577,
      lng: 110.3374,
      transactionAt: dayAt("2026-05-04", 7, 40),
      paymentMethod: PaymentMethodType.CARD,
      note: "Full tank before the Kuching-Samarahan office run.",
      litres: 38,
      totalPrice: 77.9,
    },
  ];

  for (const refill of petrolRefillPlan) {
    await createManualExpense({
      userId: refill.userId,
      merchantText: refill.merchantText,
      areaText: refill.areaText,
      lat: refill.lat,
      lng: refill.lng,
      transactionAt: refill.transactionAt,
      paymentMethod: refill.paymentMethod,
      note: refill.note,
      items: [
        {
          descriptionRaw: "Petrol RON95 refill",
          quantity: refill.litres,
          unitRaw: "litre",
          unitPrice: 2.05,
          totalPrice: refill.totalPrice,
        },
      ],
    });
  }

  await createManualExpense({
    userId: ownerId,
    merchantText: "Unifi Home Kuching",
    areaText: "Tabuan Jaya",
    transactionAt: dayAt("2026-04-16", 10),
    paymentMethod: PaymentMethodType.BANK_TRANSFER,
    note: "Monthly internet bill.",
    items: [{ descriptionRaw: "Internet bill", totalPrice: 189 }],
  });

  await createManualExpense({
    userId: ownerId,
    merchantText: "AEON Vivacity Megamall",
    areaText: "Jalan Wan Alwi",
    transactionAt: dayAt("2026-04-23", 20),
    paymentMethod: PaymentMethodType.CARD,
    note: "Bulk family shopping before Gawai balik kampung.",
    items: [
      { descriptionRaw: "Children clothes", totalPrice: 145 },
      { descriptionRaw: "Kitchenware set", totalPrice: 118 },
      { descriptionRaw: "School shoes", totalPrice: 129 },
    ],
  });

  await createManualExpense({
    userId: spouseId,
    merchantText: "Bing Coffee Tabuan",
    areaText: "Tabuan Jaya",
    transactionAt: dayAt("2026-05-03", 15),
    paymentMethod: PaymentMethodType.GRABPAY,
    items: [
      { descriptionRaw: "Coffee", totalPrice: 13.5 },
      { descriptionRaw: "Meal", totalPrice: 18.9 },
    ],
  });

  await createManualExpense({
    userId: ownerId,
    merchantText: "Sarawak Energy",
    areaText: "Kuching",
    transactionAt: dayAt("2026-05-05", 9),
    paymentMethod: PaymentMethodType.BANK_TRANSFER,
    note: "Utilities settlement.",
    items: [{ descriptionRaw: "Electric bill", totalPrice: 142.3 }],
  });

  const splitExpense = await createReceiptExpense({
    userId: ownerId,
    familyId: args.family.id,
    storeId: args.stores["emart-batu-kawa"].id,
    merchantText: args.stores["emart-batu-kawa"].displayName,
    areaText: args.stores["emart-batu-kawa"].areaText,
    lat: args.stores["emart-batu-kawa"].lat,
    lng: args.stores["emart-batu-kawa"].lng,
    transactionAt: dayAt("2026-05-07", 20),
    paymentMethod: PaymentMethodType.DUITNOW,
    note: "Shared dinner prep and pantry run before family gathering.",
    items: [
      {
        descriptionRaw: "Fresh Chicken Breast",
        canonicalName: "chicken breast",
        quantity: 1.4,
        unitRaw: "kg",
        unitPrice: 17.5,
        totalPrice: 24.5,
      },
      {
        descriptionRaw: "Beras 5kg",
        canonicalName: "rice 5kg",
        quantity: 1,
        unitRaw: "5kg",
        unitPrice: 31.5,
        totalPrice: 31.5,
      },
      {
        descriptionRaw: "Telur Gred C 30",
        canonicalName: "eggs grade c 30",
        quantity: 1,
        unitRaw: "30pcs",
        unitPrice: 12.0,
        totalPrice: 12.0,
      },
      {
        descriptionRaw: "Fresh Milk 1L",
        canonicalName: "fresh milk 1l",
        quantity: 2,
        unitRaw: "1l",
        unitPrice: 6.8,
        totalPrice: 13.6,
      },
    ],
    receiptFileRef: "seed://receipt/emart-batu-kawa/family-split.jpg",
    itemMap: args.items,
  });

  const split = await prisma.splitSession.create({
    data: {
      familyId: args.family.id,
      createdByUserId: ownerId,
      expenseId: splitExpense.id,
      title: "Family potluck groceries",
      currency: CurrencyCode.MYR,
      subtotal: decimal(81.6),
      sharedCharge: decimal(6.5),
      totalAmount: decimal(88.1),
      status: SplitStatus.FINALIZED,
      finalizedAt: dayAt("2026-05-07", 21),
      createdAt: dayAt("2026-05-07", 20, 30),
      updatedAt: dayAt("2026-05-07", 21),
    },
  });

  const participantAisyah = await prisma.splitParticipant.create({
    data: {
      splitId: split.id,
      familyMemberId: args.family.members[ownerId],
      type: SplitParticipantType.MEMBER,
      displayName: "Aisyah Rahman",
      isPayer: true,
      paidAmount: decimal(88.1),
    },
  });

  const participantHafiz = await prisma.splitParticipant.create({
    data: {
      splitId: split.id,
      familyMemberId: args.family.members[spouseId],
      type: SplitParticipantType.MEMBER,
      displayName: "Hafiz Rahman",
      isPayer: false,
      paidAmount: decimal(0),
    },
  });

  const participantNurul = await prisma.splitParticipant.create({
    data: {
      splitId: split.id,
      familyMemberId: args.family.members[sisterId],
      type: SplitParticipantType.MEMBER,
      displayName: "Nurul Rahman",
      isPayer: false,
      paidAmount: decimal(0),
    },
  });

  const splitLineMap = new Map(
    splitExpense.lineItems.map((lineItem) => [
      lineItem.descriptionRaw,
      lineItem.id,
    ]),
  );

  await prisma.splitAllocation.createMany({
    data: [
      {
        splitId: split.id,
        participantId: participantAisyah.id,
        expenseLineItemId: splitLineMap.get("Fresh Chicken Breast"),
        allocationType: SplitAllocationType.ITEM,
        lineItemLabel: "Fresh Chicken Breast",
        amount: decimal(24.5),
      },
      {
        splitId: split.id,
        participantId: participantHafiz.id,
        expenseLineItemId: splitLineMap.get("Beras 5kg"),
        allocationType: SplitAllocationType.ITEM,
        lineItemLabel: "Beras 5kg",
        amount: decimal(31.5),
      },
      {
        splitId: split.id,
        participantId: participantNurul.id,
        expenseLineItemId: splitLineMap.get("Telur Gred C 30"),
        allocationType: SplitAllocationType.ITEM,
        lineItemLabel: "Telur Gred C 30",
        amount: decimal(12.0),
      },
      {
        splitId: split.id,
        participantId: participantNurul.id,
        expenseLineItemId: splitLineMap.get("Fresh Milk 1L"),
        allocationType: SplitAllocationType.ITEM,
        lineItemLabel: "Fresh Milk 1L",
        amount: decimal(13.6),
      },
      {
        splitId: split.id,
        participantId: participantAisyah.id,
        allocationType: SplitAllocationType.SHARED_CHARGE,
        lineItemLabel: "Shared charge",
        amount: decimal(2.2),
      },
      {
        splitId: split.id,
        participantId: participantHafiz.id,
        allocationType: SplitAllocationType.SHARED_CHARGE,
        lineItemLabel: "Shared charge",
        amount: decimal(2.15),
      },
      {
        splitId: split.id,
        participantId: participantNurul.id,
        allocationType: SplitAllocationType.SHARED_CHARGE,
        lineItemLabel: "Shared charge",
        amount: decimal(2.15),
      },
    ],
  });

  await prisma.splitSettlement.createMany({
    data: [
      {
        splitId: split.id,
        fromParticipantId: participantHafiz.id,
        toParticipantId: participantAisyah.id,
        amount: decimal(33.65),
        status: SettlementStatus.PENDING,
      },
      {
        splitId: split.id,
        fromParticipantId: participantNurul.id,
        toParticipantId: participantAisyah.id,
        amount: decimal(27.75),
        status: SettlementStatus.PENDING,
      },
    ],
  });

  // --- Pre-computed cheaper alternative nudges ---
  const farleyStore = args.stores["farley-jalan-song"];
  const choiceStore = args.stores["choice-gala-city"];

  // May 2 Everrise BDC: rice and oil are cheaper at Farley (1.7 km away)
  await prisma.expense.update({
    where: { id: createdGroceryExpenses[8]!.id },
    data: {
      rawPayload: {
        seed: "kuching-demo",
        merchant: "Everrise BDC",
        cheaperOption: {
          hasAlternative: true,
          analyzedAt: dayAt("2026-05-02", 17, 30).toISOString(),
          items: [
            {
              description: "Jasmine Rice 5kg",
              currentUnitPrice: 32.2,
              cheapestStore: farleyStore.displayName,
              cheapestUnitPrice: 31.7,
              distanceKm: 1.7,
              savingsPerUnit: 0.5,
              currency: "MYR",
              storeId: farleyStore.id,
              lat: farleyStore.lat,
              lng: farleyStore.lng,
            },
            {
              description: "Cooking Oil 5kg",
              currentUnitPrice: 31.4,
              cheapestStore: farleyStore.displayName,
              cheapestUnitPrice: 31.0,
              distanceKm: 1.7,
              savingsPerUnit: 0.4,
              currency: "MYR",
              storeId: farleyStore.id,
              lat: farleyStore.lat,
              lng: farleyStore.lng,
            },
          ],
          totalSavingsEstimate: 0.9,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // May 6 Farley Jalan Song: chicken is cheaper at Choice Daily (0.7 km away)
  await prisma.expense.update({
    where: { id: createdGroceryExpenses[10]!.id },
    data: {
      rawPayload: {
        seed: "kuching-demo",
        merchant: "Farley Jalan Song",
        cheaperOption: {
          hasAlternative: true,
          analyzedAt: dayAt("2026-05-06", 19, 30).toISOString(),
          items: [
            {
              description: "Fresh Chicken Breast",
              currentUnitPrice: 17.2,
              cheapestStore: choiceStore.displayName,
              cheapestUnitPrice: 15.9,
              distanceKm: 0.7,
              savingsPerUnit: 1.3,
              currency: "MYR",
              storeId: choiceStore.id,
              lat: choiceStore.lat,
              lng: choiceStore.lng,
            },
          ],
          totalSavingsEstimate: 1.69,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // May 7 Choice Gala City: quick chicken run before the family gathering.
  // This creates a price observation at Choice so StoreMapScreen has data.
  await createReceiptExpense({
    userId: ownerId,
    familyId: args.family.id,
    storeId: choiceStore.id,
    merchantText: choiceStore.displayName,
    areaText: choiceStore.areaText,
    lat: choiceStore.lat,
    lng: choiceStore.lng,
    transactionAt: dayAt("2026-05-07", 15),
    paymentMethod: PaymentMethodType.GRABPAY,
    note: "Quick protein run before family gathering.",
    items: [
      {
        descriptionRaw: "Fresh Chicken Breast",
        canonicalName: "chicken breast" as const,
        quantity: 1.5,
        unitRaw: "kg",
        unitPrice: 15.9,
        totalPrice: 23.85,
      },
    ],
    receiptFileRef: "seed://receipt/choice-gala-city/chicken-1.jpg",
    itemMap: args.items,
  });

  // May 9 Everrise BDC: Saturday morning top-up with cheaper-alternative nudge.
  // Chicken is RM2.60/kg cheaper at Choice Gala City (2.4 km away).
  const may9Everrise = await createReceiptExpense({
    userId: ownerId,
    familyId: args.family.id,
    storeId: args.stores["everrise-bdc"].id,
    merchantText: args.stores["everrise-bdc"].displayName,
    areaText: args.stores["everrise-bdc"].areaText,
    lat: args.stores["everrise-bdc"].lat,
    lng: args.stores["everrise-bdc"].lng,
    transactionAt: dayAt("2026-05-09", 10),
    paymentMethod: PaymentMethodType.DUITNOW,
    note: "Saturday morning grocery top-up.",
    items: [
      {
        descriptionRaw: "Jasmine Rice 5kg",
        canonicalName: "rice 5kg" as const,
        quantity: 1,
        unitRaw: "5kg",
        unitPrice: 31.3,
        totalPrice: 31.3,
      },
      {
        descriptionRaw: "Cooking Oil 5kg",
        canonicalName: "cooking oil 5kg" as const,
        quantity: 1,
        unitRaw: "5kg",
        unitPrice: 30.9,
        totalPrice: 30.9,
      },
      {
        descriptionRaw: "Eggs Grade C 30",
        canonicalName: "eggs grade c 30" as const,
        quantity: 1,
        unitRaw: "30pcs",
        unitPrice: 11.9,
        totalPrice: 11.9,
      },
      {
        descriptionRaw: "Fresh Chicken Breast",
        canonicalName: "chicken breast" as const,
        quantity: 1.0,
        unitRaw: "kg",
        unitPrice: 18.5,
        totalPrice: 18.5,
      },
      {
        descriptionRaw: "Fresh Milk 1L",
        canonicalName: "fresh milk 1l" as const,
        quantity: 1,
        unitRaw: "1l",
        unitPrice: 6.75,
        totalPrice: 6.75,
      },
    ],
    receiptFileRef: "seed://receipt/everrise-bdc/may9-morning.jpg",
    itemMap: args.items,
  });

  await prisma.expense.update({
    where: { id: may9Everrise.id },
    data: {
      rawPayload: {
        seed: "kuching-demo",
        merchant: "Everrise BDC",
        cheaperOption: {
          hasAlternative: true,
          analyzedAt: dayAt("2026-05-09", 10, 30).toISOString(),
          items: [
            {
              description: "Fresh Chicken Breast",
              currentUnitPrice: 18.5,
              cheapestStore: choiceStore.displayName,
              cheapestUnitPrice: 15.9,
              distanceKm: 2.4,
              savingsPerUnit: 2.6,
              currency: "MYR",
              storeId: choiceStore.id,
              lat: choiceStore.lat,
              lng: choiceStore.lng,
            },
          ],
          totalSavingsEstimate: 2.6,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // May 9 weekend brunch at Vivacity
  await createManualExpense({
    userId: ownerId,
    merchantText: "Bing Coffee Vivacity",
    areaText: "Jalan Wan Alwi",
    transactionAt: dayAt("2026-05-09", 13),
    paymentMethod: PaymentMethodType.GRABPAY,
    note: "Weekend family brunch.",
    items: [
      { descriptionRaw: "Iced Americano", totalPrice: 14.0 },
      { descriptionRaw: "Nasi Lemak Ayam", totalPrice: 18.5 },
      { descriptionRaw: "Lemon Cheesecake", totalPrice: 13.0 },
    ],
  });
}

async function seedWeeklyReport(userId: string) {
  const slides: Prisma.InputJsonValue = [
    {
      type: "summary",
      emoji: "📊",
      metric: "RM 672.46",
      subtitle: "8 transactions · 4–9 May",
      title: "Your busiest grocery week",
      body: "You made 8 transactions this week totalling RM672.46 — 2.6× more than last week's RM261.24. Pre-Gawai restocking, a utility bill, and a Kuching petrol refill drove most of the spend.",
    },
    {
      type: "anomaly",
      emoji: "⚡",
      metric: "RM 142.30",
      subtitle: "Sarawak Energy · 5 May",
      title: "Electricity bill higher than usual",
      body: "Your electricity bill landed at RM142.30 on Monday — significantly above a typical weekday. The Labour Day long weekend likely drove higher home usage. Check if heavy appliances were left on overnight.",
    },
    {
      type: "education",
      emoji: "📖",
      title: "Why chicken prices vary across Kuching",
      body: "Fresh chicken breast can differ by RM2–3/kg across stores in the same district. Hypermarkets and daily marts source from different suppliers and use protein as a foot-traffic driver. A quick comparison before you shop can save RM3–5 per trip — no extra travel needed when stores are under 2 km apart.",
    },
    {
      type: "education",
      emoji: "⛽",
      metric: "RM 77.90",
      subtitle: "Petronas Satok · 4 May",
      title: "Petrol is now in transport spend",
      body: "The demo includes RON95 refills at Petronas Pending, Shell Jalan Song, and Petronas Satok, so Kuching transport spend can be tested alongside groceries, dining, shopping, and utilities.",
    },
    {
      type: "tip",
      emoji: "💡",
      metric: "Save ~RM 6.50",
      subtitle: "per weekly chicken purchase",
      title: "Cheaper chicken is 0.7 km away",
      body: "Choice Daily Gala City has fresh chicken breast at RM15.90/kg — RM2.60 cheaper than Everrise BDC. Both Choice and Farley Jalan Song are within 2.5 km of Everrise, so switching your protein shop this week costs nothing extra.",
    },
  ] as unknown as Prisma.InputJsonValue;

  await prisma.weeklyReport.upsert({
    where: {
      userId_weekKey: { userId, weekKey: "2026-W19" },
    },
    update: {
      slides,
      generatedAt: dayAt("2026-05-09", 8),
    },
    create: {
      userId,
      weekKey: "2026-W19",
      slides,
      generatedAt: dayAt("2026-05-09", 8),
    },
  });
}

async function seedAlerts(args: {
  userId: string;
  stores: StoreMap;
  items: ItemMap;
}) {
  const riceAlert = await prisma.priceAlert.create({
    data: {
      userId: args.userId,
      canonicalItemId: args.items["rice 5kg"].id,
      kind: AlertKind.THRESHOLD,
      areaText: "Kuching",
      targetUnitPrice: decimal(31.99),
      radiusKm: decimal(8),
      signalMinConfidence: new Prisma.Decimal("0.6500"),
      signalCooldownMinutes: 360,
      active: true,
      createdAt: dayAt("2026-05-01", 10),
      updatedAt: dayAt("2026-05-08", 9),
    },
  });

  const oilAlert = await prisma.priceAlert.create({
    data: {
      userId: args.userId,
      canonicalItemId: args.items["cooking oil 5kg"].id,
      kind: AlertKind.SIGNAL,
      storeId: args.stores["emart-batu-kawa"].id,
      areaText: "Batu Kawa",
      radiusKm: decimal(6),
      signalDecisionFilter: SignalDecisionFilter.BUY_NOW,
      signalMinConfidence: new Prisma.Decimal("0.6600"),
      signalCooldownMinutes: 480,
      active: true,
      createdAt: dayAt("2026-05-02", 11),
      updatedAt: dayAt("2026-05-08", 11),
    },
  });

  const milkAlert = await prisma.priceAlert.create({
    data: {
      userId: args.userId,
      canonicalItemId: args.items["fresh milk 1l"].id,
      kind: AlertKind.THRESHOLD,
      storeId: args.stores["everrise-bdc"].id,
      areaText: "BDC",
      targetUnitPrice: decimal(6.95),
      radiusKm: decimal(5),
      signalMinConfidence: new Prisma.Decimal("0.6500"),
      signalCooldownMinutes: 360,
      active: true,
      createdAt: dayAt("2026-05-03", 9),
      updatedAt: dayAt("2026-05-08", 11),
    },
  });

  await prisma.alertEvent.createMany({
    data: [
      {
        alertId: riceAlert.id,
        userId: args.userId,
        canonicalItemId: args.items["rice 5kg"].id,
        eventKind: AlertKind.THRESHOLD,
        storeId: args.stores["emart-batu-kawa"].id,
        areaText: "Batu Kawa",
        source: ObservationSource.PROMO,
        triggerUnitPrice: decimal(29.9),
        targetUnitPrice: decimal(31.99),
        distanceKm: decimal(4.2),
        payload: {
          delivery: {
            status: "SENT",
            attempted: 1,
            sentAt: dayAt("2026-05-08", 9, 5).toISOString(),
          },
        } satisfies Prisma.InputJsonValue,
        triggeredAt: dayAt("2026-05-08", 9),
        createdAt: dayAt("2026-05-08", 9),
        updatedAt: dayAt("2026-05-08", 9, 5),
      },
      {
        alertId: oilAlert.id,
        userId: args.userId,
        canonicalItemId: args.items["cooking oil 5kg"].id,
        eventKind: AlertKind.SIGNAL,
        storeId: args.stores["emart-batu-kawa"].id,
        areaText: "Batu Kawa",
        source: ObservationSource.PROMO,
        triggerUnitPrice: decimal(30.49),
        distanceKm: decimal(4.2),
        payload: {
          signal: {
            decision: "BUY_NOW",
            confidence: 0.78,
            expectedDeltaPct: 4.6,
          },
          delivery: {
            status: "SENT",
            attempted: 1,
            sentAt: dayAt("2026-05-08", 11, 5).toISOString(),
          },
        } satisfies Prisma.InputJsonValue,
        triggeredAt: dayAt("2026-05-08", 11),
        createdAt: dayAt("2026-05-08", 11),
        updatedAt: dayAt("2026-05-08", 11, 5),
      },
      {
        alertId: milkAlert.id,
        userId: args.userId,
        canonicalItemId: args.items["fresh milk 1l"].id,
        eventKind: AlertKind.THRESHOLD,
        storeId: args.stores["everrise-bdc"].id,
        areaText: "BDC",
        source: ObservationSource.EXPENSE,
        triggerUnitPrice: decimal(6.9),
        targetUnitPrice: decimal(6.95),
        distanceKm: decimal(2.3),
        payload: {
          delivery: {
            status: "SENT",
            attempted: 1,
            sentAt: dayAt("2026-05-02", 17, 15).toISOString(),
          },
        } satisfies Prisma.InputJsonValue,
        readAt: dayAt("2026-05-02", 19),
        triggeredAt: dayAt("2026-05-02", 17, 10),
        createdAt: dayAt("2026-05-02", 17, 10),
        updatedAt: dayAt("2026-05-02", 19),
      },
    ],
  });
}

async function seedPushDevice(userId: string) {
  await prisma.pushDevice.createMany({
    data: [
      {
        userId,
        expoPushToken: "ExponentPushToken[demo-kuching-1]",
        platform: "ios",
        appVersion: "0.1.0-demo",
        lastSeenAt: dayAt("2026-05-09", 8),
      },
      {
        userId,
        expoPushToken: "ExponentPushToken[demo-kuching-old-device]",
        platform: "ios",
        appVersion: "0.0.9-demo",
        lastSeenAt: dayAt("2026-04-20", 12),
        revokedAt: dayAt("2026-04-25", 9),
      },
    ],
  });
}

async function main() {
  await resetDemoUsers();
  const users = await seedUsers();
  const stores = await seedStores();
  const items = await seedCanonicalItems();
  const family = await seedFamily(users);
  await seedSubscriptions(users);
  await seedRewards(users);
  await seedPromos({
    userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
    stores,
    items,
  });
  await seedHouseholdData({
    users,
    family,
    stores,
    items,
  });
  await seedAlerts({
    userId: users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id,
    stores,
    items,
  });
  await seedPushDevice(users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id);

  try {
    await seedWeeklyReport(users["user_3AT9EbYugV4IirHcHRERHqTyH1e"].id);
  } catch {
    console.warn(
      "seedWeeklyReport skipped — WeeklyReport table may not exist yet. Run `npx prisma migrate dev` first.",
    );
  }

  const summary = await prisma.user.findMany({
    where: {
      clerkUserId: {
        in: DEMO_USERS.map((user) => user.clerkUserId),
      },
    },
    orderBy: {
      email: "asc",
    },
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      displayName: true,
    },
  });

  console.log("\nKuching demo seed complete.\n");
  console.table(
    summary.map((user) => ({
      displayName: user.displayName ?? "",
      email: user.email,
      clerkUserId: user.clerkUserId,
      userId: user.id,
    })),
  );

  console.log(
    "Suggested demo watchlist items: rice 5kg, cooking oil 5kg, eggs grade c 30, fresh milk 1l",
  );
  console.log(
    "Suggested demo areas: Kuching, Batu Kawa, BDC, Jalan Song, Gala City, Pending, Satok",
  );
  console.log(`Main demo family: ${FAMILY_NAME}`);
  console.log("Active invite code: KCHDEMO1");
  console.log("Recommended demo user: user_3AT9EbYugV4IirHcHRERHqTyH1e");
  console.log(`Reference month for subscription usage: ${DEMO_MONTH_KEY}`);
  console.log("");
  console.log("Feature 1 — Cheaper Alternative Nudge:");
  console.log("  Expenses with cheaperOption: May 2 Everrise BDC, May 6 Farley, May 9 Everrise BDC");
  console.log("  Choice Daily Gala City has chicken breast at RM15.90/kg (price obs seeded)");
  console.log("Feature 2 — Weekly Story Report:");
  console.log("  Pre-seeded WeeklyReport for 2026-W19 (5 slides)");
  console.log("  Current week total: RM672.46 across 8 transactions");
  console.log("  Petrol refills: Petronas Pending, Shell Jalan Song, Petronas Satok");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { AppError } from "./store.mjs";
export const defaultCampaign = {
  active: true,
  sectors: [5, 10, 5, 15, 10, 5],
  validDays: 30,
  minTotal: 0,
  tourIds: [],
  referralTrigger: "completed",
  requireVerified: false,
};
export async function createCampaigns(db, { clock }) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS campaign_settings(id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at INTEGER NOT NULL)",
  );
  await db
    .prepare("INSERT OR IGNORE INTO campaign_settings VALUES(?,?,?)")
    .run("main", JSON.stringify(defaultCampaign), clock());
  return {
    async get() {
      const row = await db
        .prepare("SELECT * FROM campaign_settings WHERE id=?")
        .get("main");
      return {
        ...defaultCampaign,
        ...JSON.parse(row.body),
        updatedAt: row.updated_at,
      };
    },
    async save(input) {
      await db
        .prepare("UPDATE campaign_settings SET body=?,updated_at=? WHERE id=?")
        .run(JSON.stringify(input), clock(), "main");
      return this.get();
    },
  };
}

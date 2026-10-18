import { fromJson } from "./database.mjs";
import { AppError } from "./store.mjs";
export const defaultCampaign = {
  active: true,
  sectors: [5, 10, 5, 15, 10, 5],
  validDays: 30,
  minTotal: 0,
  tourIds: [],
  referralTrigger: "completed",
  // Sahte hesaplarla kupon toplanmasın diye çark için e-posta doğrulaması gerekir.
  requireVerified: true,
};
export async function createCampaigns(db, { clock }) {
  await db.insertIfAbsent("campaign_settings", "main", {
    id: "main",
    body: defaultCampaign,
    updated_at: clock(),
  });
  return {
    async get() {
      const row = await db.one("campaign_settings", { _id: "main" });
      return {
        ...defaultCampaign,
        ...fromJson(row.body, {}),
        updatedAt: row.updated_at,
      };
    },
    async save(input) {
      const { updatedAt, ...body } = input;
      await db.update(
        "campaign_settings",
        { _id: "main" },
        { body, updated_at: clock() },
      );
      return this.get();
    },
  };
}

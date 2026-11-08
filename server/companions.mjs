import { randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { maskId } from "./passenger-id.mjs";
// Üyenin kayıtlı yol arkadaşları: kimlik bilgisi bir kez girilir, sonraki
// rezervasyonlarda seçilir. Numara şifreli saklanır; tarayıcıya yalnız
// maskeli hali döner, rezervasyonda sunucu kayıttan doldurur.
const MAX = 10;
export function createCompanions(db, { clock, pii }) {
  const shape = (c) => ({
    id: c.id,
    name: c.name,
    nationality: c.nationality,
    gender: c.gender,
    idMasked: maskId(pii.open(c.id_number)),
  });
  return {
    async list(memberId) {
      return (
        await db.find(
          "member_companions",
          { member_id: memberId },
          { sort: { created_at: 1 } },
        )
      ).map(shape);
    },
    async add(memberId, { name, nationality, idNumber, gender }) {
      const all = await db.find("member_companions", { member_id: memberId });
      // Aynı kişi ikinci kez eklenmez: numarası eşleşen kayıt güncellenir.
      const same = all.find((c) => pii.open(c.id_number) === idNumber);
      if (same) {
        await db.update(
          "member_companions",
          { _id: same.id },
          { name, nationality, gender },
        );
        return shape({ ...same, name, nationality, gender });
      }
      if (all.length >= MAX)
        throw new AppError(
          400,
          `En fazla ${MAX} yol arkadaşı kaydedebilirsiniz. Önce birini silin.`,
        );
      const id = randomUUID(),
        row = {
          id,
          member_id: memberId,
          name,
          nationality,
          gender,
          id_number: pii.seal(idNumber),
          created_at: clock(),
        };
      await db.insert("member_companions", id, row);
      return shape(row);
    },
    async remove(memberId, id) {
      await db.remove("member_companions", { _id: id, member_id: memberId });
      return { ok: true };
    },
    // Rezervasyon için tam bilgi (yalnız sunucu içinde kullanılır).
    async resolve(memberId, id) {
      const c = await db.one("member_companions", {
        _id: id,
        member_id: memberId,
      });
      if (!c)
        throw new AppError(400, "Seçilen yol arkadaşı hesabınızda bulunamadı.");
      return {
        name: c.name,
        detail: {
          nationality: c.nationality,
          idNumber: pii.open(c.id_number),
          gender: c.gender,
        },
      };
    },
    async exportFor(memberId) {
      return (await db.find("member_companions", { member_id: memberId })).map(
        (c) => ({
          name: c.name,
          nationality: c.nationality,
          idNumber: pii.open(c.id_number),
          gender: c.gender,
        }),
      );
    },
    removeAll(memberId) {
      return db.remove("member_companions", { member_id: memberId });
    },
  };
}

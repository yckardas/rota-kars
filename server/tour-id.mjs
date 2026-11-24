import { z } from "zod";
import { tours } from "./catalog.mjs";
// Tur kimliği doğrulaması çalışırken tur dizisine bakar: panelden kopyalanan turlar
// (bkz. content.mjs) açılıştan sonra eklendiği için z.enum(tours…) kullanılmaz.
export const isTourId = (id) => tours.some((t) => t.id === id);
export const tourIdSchema = z
  .string()
  .max(60)
  .refine(isTourId, "Tur bulunamadı.");

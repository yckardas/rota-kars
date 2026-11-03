import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { splitName } from "../server/uetds.mjs";
// Sahte U-ETDS: istek gövdesindeki işlem adına göre başarılı yanıt döner.
function fakeService() {
  const calls = [];
  const reply = (op, inner) =>
    `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:${op}Response xmlns:ns2="http://uetds.unetws.udhb.gov.tr/"><return><sonucKodu>0</sonucKodu><sonucMesaji>İŞLEM BAŞARILI</sonucMesaji>${inner}</return></ns2:${op}Response></S:Body></S:Envelope>`;
  const fetchImpl = async (url, init) => {
    const op = init.body.match(/<uet:(\w+)>/)[1];
    calls.push({ url, op, body: init.body, auth: init.headers.Authorization });
    const inner =
      op === "seferEkle"
        ? "<uetdsSeferReferansNo>555001</uetdsSeferReferansNo>"
        : op === "seferGrupEkle"
          ? "<uetdsGrupRefNo>G1</uetdsGrupRefNo><grupListe><grupId>777</grupId></grupListe>"
          : op === "yolcuEkleCoklu"
            ? [...init.body.matchAll(/<yolcuBilgileri>/g)]
                .map(
                  (_, i) =>
                    `<uetdsYolcuSonuc><sira>${i + 1}</sira><sonucKodu>0</sonucKodu><uetdsBiletRefNo>${9000 + i}</uetdsBiletRefNo></uetdsYolcuSonuc>`,
                )
                .join("")
            : op === "seferDetayCiktisiAl"
              ? `<sonucPdf>${Buffer.from("%PDF-1.4 deneme").toString("base64")}</sonucPdf>`
              : "";
    return new Response(reply(op, inner), { status: 200 });
  };
  return { calls, fetchImpl };
}
const TR = { nationality: "TR", idNumber: "10000000146", gender: "K" };
async function setup(t, env) {
  const svc = fakeService();
  const store = await openStore(":memory:", { env, uetdsFetch: svc.fetchImpl });
  t.after(() => store.db.close());
  const d = (await store.listDepartures("ani-cildir"))[0];
  await store.departures.save({
    id: d.id,
    tourId: d.tour_id,
    date: d.date,
    startTime: d.start_time,
    price: d.price,
    pickup: d.pickup,
    guideName: "",
    guidePhone: "",
    vehicleModel: "vip-midibus",
    passengerSeats: 19,
    vehicleId: "36ABN916",
    active: true,
  });
  const book = async (seat, name) => {
    const h = await store.hold(d.id, [seat]);
    const r = await store.reserve({
      holdToken: h.token,
      name,
      email: `y${seat}@example.com`,
      phone: "05551112233",
      passengers: [name],
      passengerDetails: [TR],
      paymentMode: "full",
    });
    await store.workflow.payment(r.reference, {
      amount: r.total,
      method: "cash",
      externalReference: "K-" + seat,
    });
    return store.workflow.confirm(r.reference);
  };
  return { store, svc, d, book };
}
test("ad soyad bölünür", () => {
  assert.deepEqual(splitName("Ayşe Nur Yılmaz"), {
    adi: "Ayşe Nur",
    soyadi: "Yılmaz",
  });
});
test("U-ETDS: sefer, grup, personel ve yolcular bildirilir; iptal düşülür; PDF alınır", async (t) => {
  const { store, svc, d, book } = await setup(t, {
    UETDS_USERNAME: "999999",
    UETDS_PASSWORD: "deneme",
    UETDS_START_ILCE: "1234",
  });
  await assert.rejects(store.uetds.report(d.id), /şoför/);
  await store.uetds.saveCrew(d.id, {
    driver: {
      name: "Ali Kaya",
      nationality: "TR",
      idNumber: "10000000078",
      gender: "E",
      phone: "05550000000",
    },
    guide: {
      name: "Elif Demir",
      nationality: "TR",
      idNumber: "10000000146",
      gender: "K",
    },
  });
  const a = await book(1, "Ayşe Yılmaz"),
    b = await book(2, "Can Öz");
  const first = await store.uetds.report(d.id);
  assert.equal(first.ref, "555001");
  assert.equal(first.added, 2);
  assert.deepEqual(
    svc.calls.map((c) => c.op),
    ["seferEkle", "seferGrupEkle", "personelEkle", "yolcuEkleCoklu"],
  );
  assert.ok(svc.calls.every((c) => c.url.includes("/kdgm/test/uetdsarizi")));
  assert.match(svc.calls[0].body, /<aracPlaka>36ABN916<\/aracPlaka>/);
  assert.match(
    svc.calls[2].body,
    /<turKodu>0<\/turKodu>.*<tcKimlikPasaportNo>10000000078/,
  );
  assert.match(svc.calls[3].body, /<grupId>777<\/grupId>/);
  assert.match(
    svc.calls[3].body,
    /<adi>Ayşe<\/adi><soyadi>Yılmaz<\/soyadi><koltukNo>1<\/koltukNo>/,
  );

  // Tekrar bildirimde yalnız değişiklik gider: iptal edilen yolcu düşülür.
  await store.workflow.cancel(b.reference);
  svc.calls.length = 0;
  const second = await store.uetds.report(d.id);
  assert.equal(second.cancelled, 1);
  assert.deepEqual(
    svc.calls.map((c) => c.op),
    ["yolcuIptal"],
  );
  const status = await store.uetds.status(d.id);
  assert.equal(status.reported, 1);
  assert.equal(status.driver.idMasked, "•••0078");
  assert.ok(!JSON.stringify(status).includes("10000000078"));
  assert.equal(
    (await store.uetds.pdf(d.id)).toString().slice(0, 8),
    "%PDF-1.4",
  );
  assert.ok(a);
});
test("U-ETDS kimlik bilgisi yokken kuru çalışır: istek hazırlanır, gönderilmez, kaydedilmez", async (t) => {
  const { store, svc, d, book } = await setup(t, { UETDS_START_ILCE: "1234" });
  await store.uetds.saveCrew(d.id, {
    driver: {
      name: "Ali Kaya",
      nationality: "TR",
      idNumber: "10000000078",
      gender: "E",
    },
  });
  await book(3, "Ayşe Yılmaz");
  const r = await store.uetds.report(d.id);
  assert.equal(r.mode, "dry");
  assert.equal(svc.calls.length, 0);
  assert.equal(r.preview.length, 4);
  assert.ok(!r.preview.some((p) => p.request.includes("deneme")));
  assert.equal((await store.uetds.status(d.id)).ref, null);
});

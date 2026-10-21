// Tarayıcıda CSV indirme. Excel'in formül olarak yorumlayacağı hücreler (=,+,-,@) kaçışlanır.
export function downloadCsv(
  name: string,
  rows: (string | number | null | undefined)[][],
) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const text = "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

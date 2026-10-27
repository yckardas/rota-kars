// Koltuk doluluğu bir taş sırası olarak: rehber koltuğu siyah tüf, satılan kırmızı tüf, boş kireçtaşı.
export function SeatCourse({
  sold,
  total,
  guide = true,
  size = "md",
}: {
  sold: number;
  total: number;
  guide?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const seats = Math.max(0, Math.min(total, 60)),
    filled = Math.max(0, Math.min(sold, seats));
  return (
    <span
      className={"seat-course " + size + (filled >= seats && seats > 0 ? " full" : "")}
      role="img"
      aria-label={`${filled}/${seats} koltuk dolu`}
    >
      {guide && <i className="stone guide" />}
      {Array.from({ length: seats }, (_, i) => (
        <i key={i} className={"stone" + (i < filled ? (i % 3 === 1 ? " sold alt" : " sold") : "")} />
      ))}
    </span>
  );
}

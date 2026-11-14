// Rehber yazılarının gövdesi: sade bir Markdown alt kümesi, HTML'e çevrilmeden doğrudan
// React öğeleriyle çizilir (dangerouslySetInnerHTML yok, betik sızamaz).
// Desteklenen: "## " / "### " başlık, paragraf, "- " liste, "1. " numaralı liste,
// "> " alıntı, satırda tek başına "![açıklama](/images/… ya da /media/…)" görsel,
// satır içinde **kalın** ve [bağlantı](/yol ya da https://…).
import type { ReactNode } from "react";
import { Link } from "./i18n";

const SAFE_IMAGE = /^\/(images\/[\w-]+(?:\/[\w-]+)*\.(?:webp|jpe?g|png)|media\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif))$/;
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={k}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith("/") && !href.startsWith("//"))
        return (
          <Link key={k} to={href}>
            {label}
          </Link>
        );
      if (/^https:\/\//.test(href))
        return (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      return label;
    }
    return part;
  });
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocks.map((raw, b) => {
        const block = raw.trim(),
          key = "b" + b;
        if (!block) return null;
        if (block.startsWith("### ")) return <h3 key={key}>{inline(block.slice(4), key)}</h3>;
        if (block.startsWith("## ")) return <h2 key={key}>{inline(block.slice(3), key)}</h2>;
        const lines = block.split("\n");
        const image = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (image)
          return SAFE_IMAGE.test(image[2]) ? (
            <figure key={key}>
              <img src={image[2]} alt={image[1]} loading="lazy" decoding="async" />
              {image[1] && <figcaption>{image[1]}</figcaption>}
            </figure>
          ) : null;
        if (lines.every((l) => /^- /.test(l)))
          return (
            <ul key={key}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.slice(2), key + i)}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={key}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\d+\. /, ""), key + i)}</li>
              ))}
            </ol>
          );
        if (lines.every((l) => l.startsWith(">")))
          return <blockquote key={key}>{inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), key)}</blockquote>;
        return (
          <p key={key}>
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inline(l, key + i)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

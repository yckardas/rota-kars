export const whatsappLink = (number: string, text = "") =>
  `https://wa.me/${number}${text ? "?text=" + encodeURIComponent(text) : ""}`;

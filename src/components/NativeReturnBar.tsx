import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { isNativeApp } from "../lib/native";

// Android yönetim uygulaması yalnız paneli açar. Bir bağlantı uygulamayı sitenin bir
// sayfasına (bilet, tur sayfası) götürürse üstte panele dönüş çubuğu durur.
export function NativeReturnBar() {
  if (!isNativeApp()) return null;
  return (
    <Link to="/yonetim" className="native-return-bar">
      <ArrowLeft size={18} aria-hidden="true" />
      Yönetim paneline dön
    </Link>
  );
}

import PageHeader from "../../components/PageHeader";
import Decoder from "../../components/Decoder";

export default function DecoderPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Decoder"
        description="Encode, decode and hash: Base64, URL, HTML, Hex, Unicode, ROT13, JWT decode, and SHA hashes. The Burp Decoder equivalent, running entirely in your browser."
      />
      <div className="mt-8">
        <Decoder />
      </div>
    </div>
  );
}

// Renders one JSON-LD <script> block. `JSON.stringify` alone doesn't escape
// "</", so a title/description containing literal "</script>" (however
// unlikely from our own content) could break out of the tag — the
// replacement below is the standard guard for that, applied after
// stringifying so it never touches the JSON structure itself.
export default function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

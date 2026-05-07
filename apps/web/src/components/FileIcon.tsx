type FileIconProps = {
  path: string;
  type: "file" | "directory";
  isOpen?: boolean;
};

function extension(path: string): string {
  const clean = path.split("?")[0].toLowerCase();
  const name = clean.split("/").pop() ?? clean;
  if (name === ".env" || name.endsWith(".env.example")) return "env";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

function badgeFor(path: string): string {
  const ext = extension(path);
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() ?? lower;
  if (lower.includes("/.mag/")) return "{}";
  if (ext === "json") return "{}";
  if (ext === "xcstrings") return "XCS";
  if (ext === "arb") return "ARB";
  if (["md", "markdown"].includes(ext)) return "MD";
  if (["ts", "tsx"].includes(ext)) return "TS";
  if (["js", "jsx"].includes(ext)) return "JS";
  if (ext === "kt") return "KT";
  if (ext === "java") return "JV";
  if (ext === "swift") return "S";
  if (ext === "dart") return "D";
  if (ext === "cs") return "C#";
  if (["yml", "yaml"].includes(ext)) return "YML";
  if (ext === "xml") return "XML";
  if (ext === "plist") return "PL";
  if (ext === "pbxproj") return "PBX";
  if (ext === "gradle") return "GRD";
  if (ext === "properties") return "PRP";
  if (["csproj", "sln"].includes(ext)) return ext === "sln" ? "SLN" : "CSP";
  if (ext === "lock") return "LCK";
  if (["env", "xcconfig"].includes(ext)) return "CFG";
  if (ext === "prefab") return "PRF";
  if (ext === "unity") return "SCN";
  if (["asset", "mat", "fbx"].includes(ext)) return "AST";
  if (["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) return "IMG";
  if (ext === "txt") return "TXT";
  if (name === "package.json") return "PKG";
  if (name === "pubspec.yaml") return "PUB";
  return "FILE";
}

export function FileIcon({ path, type, isOpen }: FileIconProps) {
  if (type === "directory") {
    return (
      <span className={isOpen ? "file-icon folder open" : "file-icon folder"} aria-hidden="true">
        <svg viewBox="0 0 20 16" focusable="false">
          <path d="M1.5 4.2c0-1 .8-1.8 1.8-1.8h4.1l1.5 1.7h7.8c1 0 1.8.8 1.8 1.8v6.8c0 1-.8 1.8-1.8 1.8H3.3c-1 0-1.8-.8-1.8-1.8V4.2Z" />
          {isOpen ? <path className="folder-cut" d="M2.2 7h15.6l-1.3 5.6c-.2.8-.9 1.4-1.7 1.4H3.6c-.8 0-1.5-.6-1.7-1.4L.9 8.4C.7 7.7 1.3 7 2.2 7Z" /> : null}
        </svg>
      </span>
    );
  }

  const badge = badgeFor(path);
  const badgeClass = badge === "{}" ? "json" : badge.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (
    <span className={`file-icon file ${badgeClass}`} aria-hidden="true">
      {badge}
    </span>
  );
}

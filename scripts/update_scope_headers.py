"""Generate offline scope panels and catalog labels from one reviewed manifest."""

import argparse
import html
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
START = "<!-- learning-scope:start -->"
END = "<!-- learning-scope:end -->"
STYLE_START = "<!-- learning-scope-style:start -->"
STYLE_END = "<!-- learning-scope-style:end -->"


def replace_block(text, start, end, value, anchor):
    pattern = re.escape(start) + r".*?" + re.escape(end)
    if re.search(pattern, text, flags=re.S):
        return re.sub(pattern, lambda _: value, text, count=1, flags=re.S)
    if not re.search(anchor, text, flags=re.I):
        raise ValueError(f"Missing insertion anchor: {anchor}")
    return re.sub(anchor, lambda match: match[0] + "\n" + value, text, count=1, flags=re.I)


def panel(entry):
    esc = html.escape
    rows = [("源码基线", entry["baseline"]), ("后端与配置", entry["backend"]),
            ("流程范围", entry["scope"]), ("教学假设", entry["teaching"])]
    body = "\n".join(f"<dt>{label}</dt><dd>{esc(value)}</dd>" for label, value in rows)
    return f'''{START}
<aside class="learning-scope-shell" aria-label="本页范围与源码版本">
<details class="learning-scope">
<summary><span class="learning-scope-kind">{esc(entry['kind'])}</span> 本页范围与源码版本 <span class="learning-scope-hint">展开查看</span></summary>
<dl>{body}</dl>
</details>
</aside>
{END}'''


def styles(entry, embedded):
    width = int(entry["width"])
    sizing = "width:100%;margin:0 auto 14px" if embedded else "width:calc(100% - 32px);margin:16px auto 0"
    return f'''{STYLE_START}
<style>
.learning-scope-shell{{box-sizing:border-box;max-width:{width}px;{sizing};font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif;color:#344454}}
.learning-scope{{border:1px solid #dce3e9;border-radius:8px;background:#f7f9fb;overflow-wrap:anywhere}}
.learning-scope>summary{{display:list-item;list-style:disclosure-closed inside;cursor:pointer;padding:9px 12px;font-size:13px;line-height:1.6;color:inherit}}
.learning-scope[open]>summary{{list-style-type:disclosure-open}}
.learning-scope>summary:focus-visible{{outline:2px solid #287cb8;outline-offset:3px}}
.learning-scope-kind{{font-weight:650;color:#24668f}}
.learning-scope-hint{{font-size:11px;opacity:.7;margin-left:6px}}
.learning-scope[open] .learning-scope-hint{{display:none}}
.learning-scope dl{{display:grid;grid-template-columns:88px minmax(0,1fr);gap:7px 12px;margin:0;padding:3px 12px 13px}}
.learning-scope dt{{font-weight:600}}.learning-scope dd{{margin:0}}
@media(max-width:480px){{.learning-scope dl{{grid-template-columns:1fr;gap:3px}}.learning-scope dd+dt{{margin-top:6px}}}}
:root[data-theme=dark] .learning-scope-shell{{color:#c5d1dc}}:root[data-theme=dark] .learning-scope{{background:#1b242d;border-color:#384550}}:root[data-theme=dark] .learning-scope-kind{{color:#9bcaf0}}
@media(prefers-color-scheme:dark){{:root:not([data-theme=light]) .learning-scope-shell{{color:#c5d1dc}}:root:not([data-theme=light]) .learning-scope{{background:#1b242d;border-color:#384550}}:root:not([data-theme=light]) .learning-scope-kind{{color:#9bcaf0}}}}
</style>
{STYLE_END}'''


def render_page(text, entry):
    text = replace_block(text, STYLE_START, STYLE_END, styles(entry, 'id="codex-visualization"' in text), r"<meta\b[^>]*charset[^>]*>")
    return replace_block(text, START, END, panel(entry), r"<body\b[^>]*>")


def render_catalog(text, entries):
    def update(match):
        opening, content, closing = match.groups()
        href = re.search(r'href="([^"]+)"', opening)[1]
        topic = href.split("/")[0]
        entry = entries[topic]
        content = re.sub(r'<span class="scope-badge"[^>]*>.*?</span>', '', content, flags=re.S)
        badge = f'<span class="scope-badge" title="{html.escape(entry["baseline"], quote=True)}">{html.escape(entry["kind"])}</span>'
        content = re.sub(r'(<span class="flow-title">.*?</span>)', lambda title: title[0] + badge, content, count=1, flags=re.S)
        return opening + content + closing
    return re.sub(r'(<a class="flow"[^>]*>)(.*?)(</a>)', update, text, flags=re.S)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Report stale generated content without changing files")
    args = parser.parse_args()
    entries = json.loads((ROOT / "assets/topic-scopes.json").read_text(encoding="utf-8"))
    generated = [(ROOT / "index.html", lambda text: render_catalog(text, entries))]
    for topic, entry in entries.items():
        for name in entry.get("pages", ["index.html"]):
            generated.append((ROOT / topic / name, lambda text, item=entry: render_page(text, item)))
    changed = []
    for path, render in generated:
        original = path.read_bytes().decode("utf-8")
        newline = "\r\n" if "\r\n" in original else "\n"
        updated = render(original.replace("\r\n", "\n")).replace("\n", newline)
        if original != updated:
            changed.append(path.relative_to(ROOT).as_posix())
            if not args.check:
                path.write_bytes(updated.encode("utf-8"))
    if args.check and changed:
        raise SystemExit("Scope headers need regeneration: " + ", ".join(changed))
    print(f"{'Checked' if args.check else 'Updated'} scope metadata for {len(entries)} topics / {len(generated) - 1} pages; {len(changed)} files changed.")


if __name__ == "__main__":
    main()

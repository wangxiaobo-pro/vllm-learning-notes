"""Inline the shared Scheduler palette and call-chain UI, including sandboxed diagrams."""
import argparse
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FRAME = re.compile(r'data-srcdoc="([\s\S]*?)"(?=\s*(?:>|style=))')
KINDS = ("lesson-theme", "call-adapter", "call-ui")


def block(kind, content):
    return f"<!-- {kind}:start -->\n{content}\n<!-- {kind}:end -->"


def remove_generated(text):
    text = FRAME.sub(lambda match: 'data-srcdoc="' + html.escape(remove_generated(html.unescape(match[1])), quote=True) + '"', text)
    for kind in KINDS:
        text = re.sub(r"\n?<!-- " + kind + r":start -->[\s\S]*?<!-- " + kind + r":end -->\n?", "\n", text)
    return text


def insert(text, content, closing):
    matches = list(re.finditer(closing, text, re.I))
    if matches:
        index = matches[-1].start()
        return text[:index].rstrip() + "\n" + content + "\n" + text[index:]
    return text.rstrip() + "\n" + content + "\n"


def attributes(text, topic, palette):
    def update(match):
        tag = re.sub(r'\s+data-lesson-(?:topic|palette)="[^"]*"', '', match[0])
        return tag[:-1] + f' data-lesson-topic="{topic}" data-lesson-palette="{palette}">'
    return re.sub(r'<html\b[^>]*>', update, text, count=1, flags=re.I)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--topics', help='Build only these comma-separated topic directories, preserving all other pages')
    args = parser.parse_args()
    paths = sorted(ROOT.glob('**/*.html'))
    selected_topics = set(args.topics.split(',')) if args.topics else None
    if selected_topics:
        paths = [path for path in paths if path.parent.name in selected_topics]
        missing = selected_topics - {path.parent.name for path in paths}
        if missing:
            raise ValueError('Unknown topic directories: ' + ', '.join(sorted(missing)))
    originals = {path: path.read_bytes().decode('utf-8') for path in paths}
    clean = {path: remove_generated(text.replace('\r\n', '\n')) for path, text in originals.items()}
    assets = ROOT / 'assets'
    theme = block('lesson-theme', '<style>\n' + (assets / 'lesson-theme.css').read_text(encoding='utf-8').rstrip() + '\n</style>')
    bridge = (assets / 'call-chain-bridge.js').read_text(encoding='utf-8').rstrip()
    ui_css = (assets / 'call-chain.css').read_text(encoding='utf-8').rstrip()
    ui_js = (assets / 'call-chain.js').read_text(encoding='utf-8').rstrip()
    chains = {}
    for data_file in sorted(ROOT.glob('*/call-chain.json')):
        if selected_topics and data_file.parent.name not in selected_topics:
            continue
        adapter_file = data_file.with_name('call-chain-adapter.js')
        if not adapter_file.exists():
            raise ValueError(f'Missing adapter: {adapter_file}')
        topic = data_file.parent.name
        data = json.loads(data_file.read_text(encoding='utf-8-sig'))
        data['topic'] = topic
        adapter = block('call-adapter', '<script>\n' + adapter_file.read_text(encoding='utf-8-sig').rstrip() + '\n' + bridge + '\n</script>')
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        ui = block('call-ui', '<style>\n' + ui_css + '\n</style>\n<script type="application/json" id="lesson-call-chain-data">' + payload + '</script>\n<script>\n' + ui_js + '\n</script>')
        chains[topic] = (adapter, ui)
    sources = {}
    for path, text in clean.items():
        if path.name not in ('source.html', 'source-v41.html'):
            continue
        updated = insert(text, theme, r'</head>') if '</head>' in text else insert(text, theme, r'</body>')
        if path.name == 'source.html' and path.parent.name in chains:
            updated = insert(updated, chains[path.parent.name][0], r'</body>')
        sources[path] = updated
    result = dict(sources)
    embedded = 0
    for path, text in clean.items():
        if path in sources:
            continue
        topic = path.parent.name if path.parent != ROOT else 'home'
        palette = 'text' if topic in ('home', 'scheduler') else ('matrix' if path.name.endswith('-matrices.html') else 'mcp')
        source_path = path.with_name('source.html')
        has_frame = bool(FRAME.search(text))
        def render_frame(match):
            nonlocal embedded
            inner = html.unescape(match[1])
            if source_path in sources:
                fragment = clean[source_path].strip()
                if inner.count(fragment) != 1:
                    raise ValueError(f'Expected one source fragment inside {path.relative_to(ROOT)}')
                inner = inner.replace(fragment, sources[source_path].strip(), 1)
            else:
                inner = insert(inner, theme, r'</head>')
                if topic in chains:
                    inner = insert(inner, chains[topic][0], r'</body>')
            inner = attributes(inner, topic, 'mcp')
            embedded += 1
            return 'data-srcdoc="' + html.escape(inner, quote=True) + '"'
        text = FRAME.sub(render_frame, text)
        text = attributes(text, topic, palette)
        text = insert(text, theme, r'</head>')
        if topic in chains and path.name in ('index.html', 'comparison.html'):
            if not has_frame:
                text = insert(text, chains[topic][0], r'</body>')
            text = insert(text, chains[topic][1], r'</body>')
        result[path] = text
    changed = []
    for path, text in result.items():
        newline = '\r\n' if '\r\n' in originals[path] else '\n'
        generated = text.replace('\r\n', '\n').replace('\n', newline)
        if generated != originals[path]:
            changed.append(path.relative_to(ROOT).as_posix())
            if not args.check:
                path.write_bytes(generated.encode('utf-8'))
    if args.check and changed:
        raise SystemExit('Generated learning UI is stale: ' + ', '.join(changed))
    print(f'{"Checked" if args.check else "Built"} {len(paths)} HTML files / {embedded} embedded documents / {len(chains)} call-chain topics; {len(changed)} files changed.')


if __name__ == '__main__':
    main()

"""Inline the data-driven lesson workbench without replacing other generated UI."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- lesson-workbench:start -->', '<!-- lesson-workbench:end -->'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--topics')
    args = parser.parse_args()
    css = (ROOT / 'assets/lesson-workbench.css').read_text(encoding='utf-8').rstrip()
    runtime = (ROOT / 'assets/lesson-workbench.js').read_text(encoding='utf-8').rstrip()
    routing = (ROOT / 'assets/lesson-routing.js').read_text(encoding='utf-8').rstrip()
    selected = set(args.topics.split(',')) if args.topics else None
    changed, count = [], 0
    for source in sorted(ROOT.glob('*/lesson.js')):
        topic = source.parent.name
        if selected and topic not in selected:
            continue
        definition = source.read_text(encoding='utf-8-sig').rstrip()
        scripts = (routing + '\n' + definition + '\n' + runtime).replace('</script', '<\\/script')
        content = START + '\n<style>\n' + css + '\n</style>\n<main class="lesson-workbench" id="lesson-workbench" data-topic="' + topic + '"></main>\n<noscript>请启用 JavaScript 查看逐步演算；源码与范围说明仍可阅读。</noscript>\n<script>\n' + scripts + '\n</script>\n' + END
        page = source.with_name('index.html')
        if page.exists():
            before = page.read_text(encoding='utf-8')
            if START not in before or END not in before:
                raise ValueError(f'Refusing to overwrite unrelated page: {page}')
            after = re.sub(re.escape(START) + r'[\s\S]*?' + re.escape(END), lambda _: content, before, count=1)
        else:
            before = ''
            after = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>交互学习 · vLLM 学习笔记</title>\n<style>body{margin:0}</style>\n</head>\n<body>\n' + content + '\n</body>\n</html>\n'
        count += 1
        if after != before:
            changed.append(topic)
            if not args.check:
                page.write_text(after, encoding='utf-8', newline='\n')
    if args.check and changed:
        raise SystemExit('Lesson workbench is stale: ' + ', '.join(changed))
    print(f'{"Checked" if args.check else "Built"} {count} lessons; {len(changed)} changed.')


if __name__ == '__main__':
    main()

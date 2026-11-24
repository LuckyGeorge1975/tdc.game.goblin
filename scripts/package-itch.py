"""Build an itch.io HTML5 upload from a G.O.B.L.I.N. release tag."""

import argparse
import hashlib
import json
import os
import posixpath
import re
import shutil
import subprocess
import tarfile
import tempfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
ENTRY = 'index.html'
NOTICES = 'docs/CONTENT-NOTICES.md'
UNIT_ART = 'assets/unit-art/sets/02-technical-illustration'
# Data and images addressed by runtime IDs, locale, unit type, or terrain style.
ASSET_TYPES = {
    'assets/map-bakes': {'.json', '.webp'},
    'assets/terrain-icons': {'.webp'},
    'assets/terrain-map-study/portable': {'.json', '.png', '.svg'},
    'assets/terrain-tiles': {'.webp', '.png'},
    'assets/training': {'.json'},
    'assets/ui-copy': {'.json'},
    'assets/unit-art/levels': {'.json'},
    'assets/unit-art/rules': {'.json'},
    'assets/unit-art/markers': {'.webp'},
    f'{UNIT_ART}/library': {'.webp', '.png'},
    f'{UNIT_ART}/library-enemy': {'.webp', '.png'},
    f'{UNIT_ART}/map-icons': {'.webp'},
    f'{UNIT_ART}/wrecks': {'.webp'},
    'assets/unit-art/sets/01-modular-stealth-geometry/terrain': {'.svg'},
}
REQUIRED_DATA = (
    'CHANGELOG.md',
    'assets/ai/full-attack-2a.json',
    'assets/ai/full-defender-control-trial.json',
    'assets/ai/iron-dust-target-bpn.json',
    'assets/ai/iron-dust-defender-bpn.json',
    'assets/ai/training-corpus.v1.json',
    'reports/CONTENT-NOTICES-V21.md',
    'assets/terrain-map-study/portable/manifest.json',
    'assets/training/levels.v3.json',
    'assets/training/scripts.v1.json',
    'assets/unit-art/levels/catalog-full-levels.v3.json',
    'assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',
    f'{UNIT_ART}/anchors.json',
    f'{UNIT_ART}/wreck-classes.json',
)
MODULE_REF = re.compile(r'''\b(?:from\s+|import\s*(?:\(\s*)?)["'](\.{1,2}/[^"']+)["']''')
CSS_REF = re.compile(r'''url\(\s*["']?([^"'\s)]+)["']?\s*\)''', re.IGNORECASE)


class EntryReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        self.paths.extend(value for name, value in attrs if name in {'src', 'href'} and value)


def runtime_files(archive):
    entries = {item.name: item for item in archive if not item.isdir()}
    selected = {}
    pending = [ENTRY, NOTICES, 'release.js', *REQUIRED_DATA]
    for name in entries:
        extension = PurePosixPath(name).suffix
        if any(name.startswith(directory + '/') and extension in extensions
               for directory, extensions in ASSET_TYPES.items()):
            pending.append(name)

    while pending:
        name = pending.pop()
        if name in selected:
            continue
        item = entries.get(name)
        if item is None or not item.isfile():
            raise ValueError(f'Missing or non-regular release file: {name}')
        if (len(name) > 240 or ':' in name or '\\' in name
                or any(part.startswith('.') for part in name.split('/'))):
            raise ValueError(f'Invalid ZIP path: {name}')
        if item.size > 200_000_000:
            raise ValueError(f'File exceeds the itch.io HTML5 limit: {name}')
        selected[name] = item

        suffix = PurePosixPath(name).suffix
        if suffix not in {'.html', '.css', '.js', '.mjs'}:
            continue
        code = archive.extractfile(item).read().decode('utf-8-sig')
        if suffix == '.html':
            parser = EntryReferences()
            parser.feed(code)
            refs = parser.paths
        elif suffix == '.css':
            refs = CSS_REF.findall(code)
        else:
            refs = MODULE_REF.findall(code)
        for ref in refs:
            url = urlsplit(ref)
            if url.scheme in {'https', 'data', 'mailto'} or not url.path:
                continue
            if url.scheme or url.netloc or url.path.startswith('/'):
                raise ValueError(f'{name}: expected a relative or HTTPS reference, found {ref}')
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(url.path)))
            pending.append(target)
    return selected


def sha256(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def preserve_file(source, target):
    try:
        if os.name == 'nt':
            source.rename(target)
        else:
            os.link(source, target)
    except FileExistsError:
        if sha256(source) != sha256(target):
            raise ValueError(f'Existing artifact has different bytes: {target}')


def build(git, output, tag, expected_commit):
    commit = subprocess.check_output([
        *git, 'rev-parse', '--verify', f'refs/tags/{tag}^{{commit}}',
    ]).decode().strip()
    if commit != expected_commit:
        raise ValueError(f'{tag} resolves to {commit}, expected {expected_commit}')

    output.mkdir(parents=True, exist_ok=True)
    name = f'goblin-{tag}-html5-{commit[:12]}'
    with tempfile.TemporaryDirectory(dir=output) as directory:
        temp = Path(directory)
        tar_path = temp / 'source.tar'
        zip_path = temp / f'{name}.zip'
        subprocess.run([
            *git, 'archive', '--format=tar', '--output', str(tar_path), commit,
        ], check=True)
        with tarfile.open(tar_path) as archive:
            files = runtime_files(archive)
            release = archive.extractfile(files['release.js']).read().decode('utf-8')
            version = tag[1:]
            if not re.search(r'\bversion\s*:\s*[\'\"]' + re.escape(version) + r'[\'\"]', release):
                raise ValueError(f'release.js does not declare version {version}')
            total = sum(item.size for item in files.values())
            if len(files) > 1000 or total > 500_000_000:
                raise ValueError(f'HTML5 extraction limit exceeded: {len(files)} files, {total} bytes')
            if len({path.casefold() for path in files}) != len(files):
                raise ValueError('ZIP contains paths that differ only in case')

            with ZipFile(zip_path, 'w') as upload:
                for path, item in sorted(files.items()):
                    info = ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = 0o100644 << 16
                    upload.writestr(info, archive.extractfile(item).read(), ZIP_DEFLATED, compresslevel=6)

        with ZipFile(zip_path) as upload:
            if damaged := upload.testzip():
                raise ValueError(f'ZIP integrity check failed: {damaged}')

        receipt = {
            'tag': tag,
            'commit': commit,
            'version': version,
            'file': zip_path.name,
            'sha256': sha256(zip_path),
            'zipBytes': zip_path.stat().st_size,
            'files': len(files),
            'extractedBytes': total,
        }
        receipt_path = temp / f'{name}.json'
        receipt_path.write_bytes((json.dumps(receipt, indent=2) + '\n').encode('utf-8'))
        preserve_file(zip_path, output / zip_path.name)
        preserve_file(receipt_path, output / receipt_path.name)
    print(json.dumps(receipt, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tag', help='Release tag, for example v0.1.30')
    parser.add_argument('commit', help='Observed full commit SHA of that tag')
    parser.add_argument('--output', type=Path, required=True, help='Directory for the ZIP and its receipt')
    parser.add_argument('--git-wrapper', type=Path, help='Optional PowerShell Git wrapper for local builds')
    parser.add_argument('--pwsh', default=shutil.which('pwsh'), help='Path to PowerShell 7')
    args = parser.parse_args()
    if not re.fullmatch(r'v\d+\.\d+\.\d+', args.tag) or not re.fullmatch(r'[0-9a-f]{40}', args.commit):
        parser.error('Supply a version tag and its full lowercase commit SHA')
    git = ['git']
    if args.git_wrapper:
        if not args.pwsh:
            parser.error('The Git wrapper needs PowerShell 7 on PATH or supplied using --pwsh')
        git = [args.pwsh, '-NoProfile', '-File', str(args.git_wrapper.resolve())]
    try:
        build([*git, '-C', str(ROOT)], args.output.resolve(), args.tag, args.commit)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()

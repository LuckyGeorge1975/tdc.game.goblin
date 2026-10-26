"""Export exactly the pinned 52 wrecks and two metadata files; never run at build time.

Use a SHA-256 verified Git archive from the workspace .tools/content-source cache.
--preview writes eight representative derivatives only to the fixed QA folder.
The regular run writes only fixed runtime paths, refusing different existing files.
"""
import argparse
import hashlib
import io
import json
import math
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).absolute().parents[1]
WORKSPACE = ROOT.parent
CACHE = WORKSPACE / '.tools/content-source'
PREVIEW = WORKSPACE / '.tools/export-nbg-20-2-3/preview'
SOURCE = 'beratung-ui-ux/design-exports/einheitengrafiken'
SET = 'assets/unit-art/sets/02-technical-illustration'
RECEIPT = 'assets/unit-art/wrecks-source.json'
SCRIPT = 'scripts/export-wrecks.py'
VERSION = 1
SIZE = 192
SIDES = {'eigen': ('own', 'player'), 'gegner': ('enemy', 'enemy')}
SAMPLES = {'infantry-squad', 'guard-tank', 'command-core', 'goblin-siegebreaker'}
ANCHOR_CLASSES = {'cannon', 'twin', 'quad', 'longgun', 'lightgun', 'rifles',
                  'light', 'none', 'rockets', 'missile'}
WRECK_CLASSES = {'infanterie', 'fahrzeug', 'schwer', 'bauwerk'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(base, candidate):
    """No alternate destination, traversal, symlink, junction or other reparse point."""
    base, candidate = Path(base).absolute(), Path(candidate).absolute()
    if '..' in candidate.parts or not candidate.is_relative_to(base):
        raise ValueError('path outside allowed root')
    for item in (candidate, *candidate.parents):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise ValueError(f'reparse/symlink path rejected: {item}')
    return candidate


def unit_ids(manifest_bytes):
    units = json.loads(manifest_bytes)['units']
    ids = [unit['id'] for unit in units]
    if len(ids) != 26 or len(set(ids)) != 26 or any(
            not isinstance(uid, str) or not re.fullmatch(r'[a-z][a-z0-9-]*', uid) for uid in ids):
        raise ValueError('expected 26 distinct canonical IDs')
    return ids


def decode_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate JSON key')
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=unique)


def metadata(anchors_bytes, classes_bytes, ids):
    anchors, classes = decode_json(anchors_bytes), decode_json(classes_bytes)
    expected = {f'{uid}-{side}' for uid in ids for side in SIDES}
    if not isinstance(anchors, dict) or set(anchors) != set(ids):
        raise ValueError('anchor membership mismatch')
    if not isinstance(classes, dict) or set(classes) != expected:
        raise ValueError('wreck class membership mismatch')
    if any(value not in WRECK_CLASSES for value in classes.values()):
        raise ValueError('unknown wreck class')
    for anchor in anchors.values():
        if not isinstance(anchor, dict) or set(anchor) != {'klasse', 'own', 'enemy'}:
            raise ValueError('invalid anchor schema')
        if anchor['klasse'] not in ANCHOR_CLASSES:
            raise ValueError('unknown anchor class')
        for side in ('own', 'enemy'):
            points = anchor[side]
            if not isinstance(points, list) or len(points) > 5:
                raise ValueError('invalid anchor points')
            if anchor['klasse'] in {'none', 'rockets', 'missile'} and points:
                raise ValueError('unexpected anchor points')
            for point in points:
                if not isinstance(point, list) or len(point) != 2 or any(
                    type(value) not in (int, float) or not math.isfinite(value) or abs(value) > 128
                    for value in point):
                    raise ValueError('invalid anchor coordinate')


def read_archive(data, source_sha, ids):
    expected = {f'{SOURCE}/wracks/{uid}-{side}.png' for uid in ids for side in SIDES}
    expected |= {f'{SOURCE}/anchors.json', f'{SOURCE}/wracks/klassen.json'}
    directories = {str(parent) + '/' for name in expected for parent in PurePosixPath(name).parents
                   if str(parent) != '.'}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.comment != source_sha.encode('ascii'):
            raise ValueError('Git archive commit mismatch')
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(names) != len(set(names)):
            raise ValueError('duplicate ZIP entry')
        for item in entries:
            name = item.filename
            if name not in expected | directories or '\\' in name:
                raise ValueError(f'non-allowlisted ZIP entry: {name}')
            mode = item.external_attr >> 16
            if stat.S_ISLNK(mode) or item.flag_bits & 1 or item.file_size > 1024 * 1024:
                raise ValueError('unsafe ZIP entry')
            if name in directories and not item.is_dir():
                raise ValueError('directory entry is a file')
        files = {item.filename for item in entries if not item.is_dir()}
        if files not in ({f'{SOURCE}/anchors.json'}, expected - {f'{SOURCE}/anchors.json'}):
            raise ValueError('expected anchors-only or exact 53-file wreck archive')
        return {name: archive.read(name) for name in sorted(files)}


def image_facts(image):
    alpha = image.getchannel('A')
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError('empty alpha image')
    return {'format': image.format, 'mode': image.mode, 'size': list(image.size),
            'alphaBounds': list(bounds),
            'canvasCenter': [image.width / 2, image.height / 2]}


def encode(source):
    with Image.open(io.BytesIO(source)) as image:
        if image.format != 'PNG' or image.mode != 'RGBA' or image.size != (256, 256):
            raise ValueError('expected 256x256 RGBA PNG')
        if getattr(image, 'n_frames', 1) != 1:
            raise ValueError('animated PNG rejected')
        source_facts = image_facts(image)
        resized = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    resized.save(output, format='WEBP', lossless=True, quality=100, method=6, exact=True)
    data = output.getvalue()
    with Image.open(io.BytesIO(data)) as decoded:
        if decoded.format != 'WEBP' or decoded.mode != 'RGBA' or decoded.size != (SIZE, SIZE):
            raise ValueError('invalid WebP output')
        if decoded.tobytes() != resized.tobytes():
            raise ValueError('WebP roundtrip changed resized pixels')
        target_facts = image_facts(decoded)
    return data, source_facts, target_facts


def prepare(archives, source_sha, archive_hashes, manifest_bytes, preview=False):
    if not re.fullmatch(r'[0-9a-f]{40}', source_sha):
        raise ValueError('full source SHA required')
    if len(archives) != 2 or len(archive_hashes) != 2:
        raise ValueError('exactly two archive/hash pairs required')
    ids = unit_ids(manifest_bytes)
    sources, archive_facts = {}, []
    for data, expected_hash in zip(archives, archive_hashes):
        if not re.fullmatch(r'[0-9a-f]{64}', expected_hash) or digest(data) != expected_hash:
            raise ValueError('archive SHA-256 mismatch')
        entries = read_archive(data, source_sha, ids)
        if sources.keys() & entries.keys():
            raise ValueError('duplicate source across archives')
        sources.update(entries)
        archive_facts.append({'sha256': expected_hash, 'bytes': len(data), 'sourcePaths': sorted(entries)})
    if len(sources) != 54:
        raise ValueError('expected exactly 54 source files')
    metadata(sources[f'{SOURCE}/anchors.json'], sources[f'{SOURCE}/wracks/klassen.json'], ids)
    outputs, images = {}, []
    for uid in ids:
        if preview and uid not in SAMPLES:
            continue
        for side, (directory, team) in SIDES.items():
            path = f'{SOURCE}/wracks/{uid}-{side}.png'
            source = sources[path]
            data, before, after = encode(source)
            target = f'{SET}/wrecks/{directory}/{uid}.webp'
            outputs[target] = data
            images.append({'unitId': uid, 'team': team, 'sourcePath': path,
                'sourceSha256': digest(source), 'sourceBytes': len(source), 'sourceImage': before,
                'runtimePath': target, 'runtimeSha256': digest(data), 'runtimeBytes': len(data),
                'runtimeImage': after, 'resizedPixelsLossless': True})
    meta = []
    for source, target in [(f'{SOURCE}/anchors.json', f'{SET}/anchors.json'),
                           (f'{SOURCE}/wracks/klassen.json', f'{SET}/wreck-classes.json')]:
        data = sources[source]
        outputs[target] = data
        meta.append({'sourcePath': source, 'runtimePath': target, 'sourceSha256': digest(data),
                     'runtimeSha256': digest(data), 'sourceBytes': len(data), 'runtimeBytes': len(data),
                     'transformation': 'byte-identical copy; original 256px anchor coordinates'})
    receipt = {'schemaVersion': 1, 'sourceRepository': 'https://github.com/LuckyGeorge1975/tdc.game.goblin.content',
        'sourceCommit': source_sha, 'sourceArchives': archive_facts, 'sourceFileCount': 54,
        'previewOnly': preview, 'manifestSha256': digest(manifest_bytes.replace(b'\r\n', b'\n')),
        'manifestHashNormalization': 'CRLF to LF; manifest file unchanged',
        'archiveMetadataNote': 'Git archive may convert text line endings; source hashes below '
            'describe the raw verified archive entries, copied byte-identically to runtime metadata.',
        'export': {'script': SCRIPT, 'scriptSha256': digest(Path(__file__).read_bytes()),
            'version': VERSION, 'pillowVersion': pillow_version, 'size': SIZE, 'format': 'WebP',
            'resampling': 'Lanczos', 'lossless': True, 'quality': 100, 'method': 6, 'exact': True,
            'crop': False, 'sourceCanvasCenter': [128, 128], 'runtimeCanvasCenter': [96, 96]},
        'provenance': {'wrecks': 'code-generated from shadowless icons; icons/werkzeuge/wracks.py',
            'anchors': 'alpha-derived; icons/werkzeuge/anchors.py',
            'enemyLibraryImported': False, 'weaponGroupAnchors': 'not supplied; inactive data only'},
        'sourceImageTotalBytes': sum(item['sourceBytes'] for item in images),
        'runtimeImageTotalBytes': sum(item['runtimeBytes'] for item in images),
        'metadata': meta, 'wrecks': images}
    return outputs, receipt


def write_outputs(base, outputs):
    # Validate every destination before the first write. Existing equal files are a no-op.
    destinations = []
    for relative, data in outputs.items():
        target = safe_path(base, Path(base) / relative)
        if target.exists() and (not target.is_file() or target.read_bytes() != data):
            raise ValueError(f'refusing to replace different destination: {target}')
        destinations.append((target, data))
    for target, data in destinations:
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            safe_path(base, target)
            with target.open('xb') as handle:
                handle.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, action='append', required=True)
    parser.add_argument('--archive-sha256', action='append', required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    archives = [safe_path(CACHE, path) for path in args.archive]
    if any(not archive.is_file() or archive.stat().st_size > 8 * 1024 * 1024 for archive in archives):
        raise ValueError('invalid source archive')
    manifest = safe_path(ROOT, ROOT / 'assets/unit-art/manifest.json').read_bytes()
    outputs, receipt = prepare([archive.read_bytes() for archive in archives], args.source_sha,
                               args.archive_sha256, manifest, args.preview)
    if args.preview:
        outputs = {PurePosixPath(path).parts[-2] + '/' + PurePosixPath(path).name: data
                   for path, data in outputs.items() if path.endswith('.webp')}
        outputs['preview-receipt.json'] = (json.dumps(receipt, indent=2) + '\n').encode('utf-8')
        write_outputs(PREVIEW, outputs)
    else:
        outputs[RECEIPT] = (json.dumps(receipt, indent=2) + '\n').encode('utf-8')
        write_outputs(ROOT, outputs)
    print(f"{len(receipt['wrecks'])} wrecks: {receipt['sourceImageTotalBytes']} -> "
          f"{receipt['runtimeImageTotalBytes']} bytes; preview={args.preview}")


if __name__ == '__main__':
    main()

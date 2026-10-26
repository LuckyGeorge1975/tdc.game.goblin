"""Local exporter tests with synthetic sources; no private repository required.

python -B -m unittest discover -s tests -p test_export_wrecks.py
"""
import importlib.util
import io
import json
import stat
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image, ImageDraw

ROOT = Path(__file__).absolute().parents[1]
spec = importlib.util.spec_from_file_location('wreck_export', ROOT / 'scripts/export-wrecks.py')
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)
MANIFEST = (ROOT / 'assets/unit-art/manifest.json').read_bytes()
IDS = export.unit_ids(MANIFEST)
SHA = 'a' * 40


def png(mode='RGBA', size=(256, 256), empty=False):
    image = Image.new(mode, size)
    if not empty:
        ImageDraw.Draw(image).rectangle((30, 50, 190, 180), fill=(70, 50, 40, 255) if mode == 'RGBA' else (70, 50, 40))
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def fixture():
    source = png()
    anchors = {uid: {'klasse': 'cannon', 'own': [[30, 4]], 'enemy': [[31, 5]]} for uid in IDS}
    classes = {f'{uid}-{side}': 'fahrzeug' for uid in IDS for side in export.SIDES}
    files = {f'{export.SOURCE}/wracks/{uid}-{side}.png': source for uid in IDS for side in export.SIDES}
    files[f'{export.SOURCE}/wracks/klassen.json'] = json.dumps(classes).encode()
    anchor_files = {f'{export.SOURCE}/anchors.json': json.dumps(anchors).encode()}
    return files, anchor_files


def archive(files, comment=SHA, extra=None):
    stream = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        with zipfile.ZipFile(stream, 'w') as target:
            target.comment = comment.encode()
            for name, value in files.items():
                target.writestr(zipfile.ZipInfo(name, date_time=(2026, 10, 26, 0, 0, 0)), value)
            if extra:
                target.writestr(*extra)
    return stream.getvalue()


def prepare(files=None, anchor_files=None, manifest=MANIFEST):
    default_files, default_anchors = fixture()
    data = [archive(default_files if files is None else files),
            archive(default_anchors if anchor_files is None else anchor_files)]
    return export.prepare(data, SHA, list(map(export.digest, data)), manifest)


class ExportTests(unittest.TestCase):
    def test_complete_reproducible_export_and_provenance(self):
        outputs, receipt = prepare()
        repeated, repeated_receipt = prepare(manifest=MANIFEST.replace(b'\r\n', b'\n'))
        self.assertEqual(outputs, repeated)
        self.assertEqual(receipt, repeated_receipt)
        self.assertEqual(len(outputs), 54)
        self.assertEqual(len(receipt['wrecks']), 52)
        self.assertEqual(receipt['sourceFileCount'], 54)
        self.assertEqual(receipt['export']['scriptSha256'], export.digest((ROOT / export.SCRIPT).read_bytes()))
        for entry in receipt['wrecks']:
            self.assertEqual(export.digest(outputs[entry['runtimePath']]), entry['runtimeSha256'])
            self.assertEqual(entry['runtimeImage']['size'], [192, 192])
            self.assertEqual(entry['runtimeImage']['canvasCenter'], [96, 96])
            self.assertTrue(entry['resizedPixelsLossless'])
        for entry in receipt['metadata']:
            self.assertEqual(entry['sourceSha256'], entry['runtimeSha256'])

    def test_missing_pair_and_extra_source_fail_before_writes(self):
        files, anchors = fixture()
        del files[next(iter(files))]
        with self.assertRaises(ValueError):
            prepare(files, anchors)
        files, anchors = fixture()
        files[f'{export.SOURCE}/wracks/unexpected-eigen.png'] = png()
        with self.assertRaises(ValueError):
            prepare(files, anchors)

    def test_zip_traversal_absolute_duplicate_and_symlink_rejected(self):
        files, _ = fixture()
        for path in ['../escape.png', '/absolute.png', 'C:\\escape.png', next(iter(files))]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                export.read_archive(archive(files, extra=(path, b'x')), SHA, IDS)
        info = zipfile.ZipInfo(next(iter(files)))
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        without = {name: value for name, value in files.items() if name != info.filename}
        with self.assertRaises(ValueError):
            export.read_archive(archive(without, extra=(info, b'elsewhere')), SHA, IDS)

    def test_archive_hash_commit_and_cross_archive_duplicate_rejected(self):
        files, anchors = fixture()
        a, b = archive(files), archive(anchors)
        with self.assertRaises(ValueError):
            export.prepare([a, b], SHA, ['0' * 64, export.digest(b)], MANIFEST)
        with self.assertRaises(ValueError):
            export.read_archive(archive(files, comment='b' * 40), SHA, IDS)
        with self.assertRaises(ValueError):
            export.prepare([a, a], SHA, [export.digest(a)] * 2, MANIFEST)

    def test_metadata_missing_type_wrong_class_and_invalid_coordinates(self):
        files, anchors = fixture()
        key = f'{export.SOURCE}/anchors.json'
        original = json.loads(anchors[key])
        variants = []
        missing = dict(original)
        del missing[IDS[0]]
        variants.append(missing)
        for value in [float('nan'), float('inf'), True, 129]:
            changed = json.loads(anchors[key])
            changed[IDS[0]]['own'] = [[value, 0]]
            variants.append(changed)
        changed = json.loads(anchors[key])
        changed[IDS[0]]['klasse'] = 'new-weapon'
        variants.append(changed)
        for changed in variants:
            with self.assertRaises(ValueError):
                prepare(files, {key: json.dumps(changed).encode()})
        classes_key = f'{export.SOURCE}/wracks/klassen.json'
        classes = json.loads(files[classes_key])
        classes[next(iter(classes))] = 'gameplay-cover'
        files[classes_key] = json.dumps(classes).encode()
        with self.assertRaises(ValueError):
            prepare(files, anchors)
        with self.assertRaises(ValueError):
            export.decode_json(b'{"a":1,"a":2}')

    def test_image_mode_dimensions_and_empty_alpha_rejected(self):
        for data in [png('RGB'), png(size=(255, 256)), png(empty=True), b'not png']:
            with self.assertRaises((ValueError, OSError)):
                export.encode(data)

    def test_manifest_foreign_ids_and_duplicates_rejected(self):
        manifest = json.loads(MANIFEST)
        for replacement in ['../escape', IDS[1]]:
            manifest['units'][0]['id'] = replacement
            with self.assertRaises(ValueError):
                export.unit_ids(json.dumps(manifest).encode())

    def test_output_parent_file_conflicts_reject_before_any_write(self):
        runs = export.PREVIEW.parent / 'test-runs'
        runs.mkdir(parents=True, exist_ok=True)
        for suffix in ('second.webp', 'deeper/second.webp'):
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory(dir=runs) as directory:
                base = Path(directory)
                (base / 'blocked').write_bytes(b'keep')
                with self.assertRaises(ValueError):
                    export.write_outputs(base, {'new-dir/first.webp': b'new',
                                                f'blocked/{suffix}': b'new'})
                self.assertEqual(sorted(path.name for path in base.iterdir()), ['blocked'])
                self.assertEqual((base / 'blocked').read_bytes(), b'keep')
                with self.assertRaises(ValueError):
                    export.write_outputs(base / 'blocked', {'third.webp': b'new'})
                self.assertEqual((base / 'blocked').read_bytes(), b'keep')

    def test_output_containment_reparse_and_conflict_preflight(self):
        runs = export.PREVIEW.parent / 'test-runs'
        runs.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=runs) as directory:
            base = Path(directory)
            for path in [base / '..' / 'escape', base.parent / 'outside']:
                with self.assertRaises(ValueError):
                    export.safe_path(base, path)
            fake = SimpleNamespace(st_mode=stat.S_IFDIR, st_file_attributes=0x400)
            with patch.object(Path, 'lstat', return_value=fake), self.assertRaises(ValueError):
                export.safe_path(base, base / 'reparse')
            (base / 'existing').write_bytes(b'keep')
            with self.assertRaises(ValueError):
                export.write_outputs(base, {'new': b'new', 'existing': b'change'})
            self.assertFalse((base / 'new').exists())
            self.assertEqual((base / 'existing').read_bytes(), b'keep')
            export.write_outputs(base, {'existing': b'keep', 'new': b'new'})
            export.write_outputs(base, {'existing': b'keep', 'new': b'new'})
            self.assertEqual((base / 'new').read_bytes(), b'new')


if __name__ == '__main__':
    unittest.main()

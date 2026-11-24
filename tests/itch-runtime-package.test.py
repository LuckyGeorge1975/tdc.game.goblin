"""Synthetic package inventory/byte-copy guards; these are not gameplay fixtures."""
import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('package_itch', ROOT / 'scripts/package-itch.py')
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)
MODELS = (
    'assets/ai/full-attack-2a.json',
    'assets/ai/full-defender-control-trial.json',
    'assets/ai/iron-dust-target-bpn.json',
    'assets/ai/iron-dust-defender-bpn.json',
    'assets/ai/training-corpus.v1.json',
)


def fixture(extra=None):
    files = {name: ('synthetic ' + name + '\n').encode() for name in recipe.REQUIRED_DATA}
    files.update({'index.html': b'<html>synthetic inventory fixture</html>',
                  'release.js': b"const release={version:'0.1.33'};\n",
                  recipe.NOTICES: b'Synthetic notices\n',
                  '.tools/private-weights.json': b'not selected',
                  'assets/ai/unapproved-new-model.json': b'not selected'})
    files.update(extra or {})
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as archive:
        for name, data in files.items():
            item = tarfile.TarInfo(name)
            item.size = len(data)
            archive.addfile(item, io.BytesIO(data))
    return output.getvalue(), files


def build_fixture(tar_bytes, output):
    def archive_command(args, **_kwargs):
        Path(args[args.index('--output') + 1]).write_bytes(tar_bytes)
    with patch.object(recipe.subprocess, 'check_output', return_value=b'1' * 40), \
            patch.object(recipe.subprocess, 'run', side_effect=archive_command), \
            contextlib.redirect_stdout(io.StringIO()):
        recipe.build(['synthetic-git'], output, 'v0.1.33', '1' * 40)


class RuntimeInventory(unittest.TestCase):
    def test_exact_existing_models_manifest_and_raw_zip_bytes(self):
        tar_bytes, originals = fixture()
        with tarfile.open(fileobj=io.BytesIO(tar_bytes)) as archive:
            selected = recipe.runtime_files(archive)
        for name in MODELS:
            self.assertIn(name, selected)
        self.assertNotIn('.tools/private-weights.json', selected)
        self.assertNotIn('assets/ai/unapproved-new-model.json', selected)
        base = ROOT / '.tools/itch-runtime-tests'
        base.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as directory:
            output = Path(directory)
            build_fixture(tar_bytes, output)
            with ZipFile(next(output.glob('*.zip'))) as archive:
                self.assertEqual(set(archive.namelist()), set(selected))
                self.assertIsNone(archive.testzip())
                for name in MODELS:
                    self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(),
                                     hashlib.sha256(originals[name]).hexdigest())

    def test_real_builder_rejects_over_html5_file_limit(self):
        tar_bytes, _ = fixture({f'assets/map-bakes/fixture-{i}.json': b'{}' for i in range(1001)})
        base = ROOT / '.tools/itch-runtime-tests'
        base.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as directory:
            with self.assertRaisesRegex(ValueError, 'HTML5 extraction limit exceeded'):
                build_fixture(tar_bytes, Path(directory))
            self.assertEqual(list(Path(directory).glob('*.zip')), [])


if __name__ == '__main__':
    unittest.main()

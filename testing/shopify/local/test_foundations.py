import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock,patch

spec=importlib.util.spec_from_file_location('foundations',Path(__file__).with_name('foundations.py'))
foundations=importlib.util.module_from_spec(spec);spec.loader.exec_module(foundations)

class FoundationSafety(unittest.TestCase):
    def test_rejects_nonlocal_database_before_docker_execution(self):
        stack=Mock()
        with self.assertRaisesRegex(RuntimeError,'disposable_database_only'):
            foundations.execute(stack,'local-db','select 1','production')
        stack.docker.assert_not_called()

    def test_existing_check_database_needs_local_provenance(self):
        stack=Mock();stack.docker.return_value='1'
        with patch.object(foundations,'runtime',return_value=(stack,{},'local-db')):
            with patch.object(foundations,'execute',return_value='f'):
                with patch.object(foundations,'apply_chain') as apply:
                    with self.assertRaisesRegex(RuntimeError,'existing_database_provenance_unverified'):
                        foundations.main()
                    apply.assert_not_called()

    def test_delta_source_drift_stops_before_any_reapplication(self):
        stack=Mock()
        with patch.object(foundations,'execute',side_effect=['','', '0'*64]) as execute:
            with self.assertRaisesRegex(RuntimeError,'source_delta_changed:'):
                foundations.apply_chain(stack,'local-db')
            self.assertEqual(execute.call_count,3)
            self.assertIn('select sha256',execute.call_args.args[2])

if __name__=='__main__':unittest.main()

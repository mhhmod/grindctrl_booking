import base64
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('local_stack',Path(__file__).with_name('stack.py'))
stack=importlib.util.module_from_spec(spec)
spec.loader.exec_module(stack)

class LocalTargetSafety(unittest.TestCase):
    def test_cannot_address_a_hosted_database(self):
        with patch.object(stack,'docker') as call:
            with self.assertRaisesRegex(RuntimeError,'disposable local database'):
                stack.sql({'prefix':'local'},'select 1','prsusuwxbzaekynonifl')
            call.assert_not_called()

    def test_all_external_images_are_digest_bound(self):
        for image in stack.IMAGES.values():
            self.assertRegex(image,r'@sha256:[a-f0-9]{64}$')

    def test_local_credentials_are_private_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'test-only'
            stack.private_write(path,'synthetic')
            self.assertEqual(path.stat().st_mode&0o777,0o600)
            with self.assertRaises(FileExistsError):stack.private_write(path,'replacement')
            self.assertEqual(path.read_text(),'synthetic')

    def test_missing_or_expired_target_fails_closed(self):
        with tempfile.TemporaryDirectory() as d,patch.object(stack,'STATE',Path(d)):
            with self.assertRaises(FileNotFoundError):stack.state()
            (Path(d)/'state.json').write_text(json.dumps({'kind':'disposable-local-only','expires_at':0}))
            with self.assertRaisesRegex(RuntimeError,'expired'):stack.state()

    def test_docker_uses_only_local_socket_and_preserves_system_identity(self):
        class Result:
            returncode=0
            stdout='ok'
        with patch.dict(os.environ,{'DOCKER_HOST':'tcp://production:2376','DOCKER_CONTEXT':'production'}):
            with patch.object(stack.subprocess,'run',return_value=Result()) as call:
                self.assertEqual(stack.docker('info'),'ok')
                args=call.call_args
                self.assertEqual(args.args[0][:2],['docker','--host=unix:///var/run/docker.sock'])
                self.assertNotIn('DOCKER_HOST',args.kwargs['env'])
                self.assertNotIn('DOCKER_CONTEXT',args.kwargs['env'])
                self.assertEqual(args.kwargs['env']['HOME'],os.environ['HOME'])

    def test_local_jwt_is_bounded_and_not_an_external_identity(self):
        value=stack.jwt('synthetic-test-only','service_role')
        body=value.split('.')[1]
        data=json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        self.assertEqual(data['role'],'service_role')
        self.assertEqual(data['iss'],'grindctrl-local-only')
        self.assertLessEqual(data['exp']-data['iat'],86400)

    def test_docker_failure_does_not_echo_payload_or_credentials(self):
        class Result:
            returncode=1
            stdout='sensitive'
            stderr='sensitive'
        with patch.object(stack.subprocess,'run',return_value=Result()):
            with self.assertRaisesRegex(RuntimeError,'^local Docker operation failed: exec$'):
                stack.docker('exec','local',data='sensitive')

    def test_only_fixed_router_has_ingress_and_internal_alias(self):
        with patch.object(stack,'docker') as call:
            stack.run({'prefix':'gc-m1-12345678'},'gateway',stack.IMAGES['node'])
            run=call.call_args_list[0].args
            self.assertEqual(run[run.index('--network')+1],'gc-m1-12345678-edge')
            self.assertEqual(call.call_args_list[1].args,
              ('network','connect','--alias','gateway','gc-m1-12345678','gc-m1-12345678-gateway'))
        with patch.object(stack,'docker') as call:
            stack.run({'prefix':'gc-m1-12345678'},'app','synthetic-local-image')
            run=call.call_args.args
            self.assertEqual(run[run.index('--network')+1],'gc-m1-12345678')
            self.assertEqual(call.call_count,1)

if __name__=='__main__':unittest.main()

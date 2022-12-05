# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import argparse
import json
import os
import pathlib
import sys
import traceback
import unittest
from typing import List, Literal, Optional, Tuple, TypedDict, Union

PYTHON_FILES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PYTHON_FILES)

from django.test.runner import DiscoverRunner

from unittest_utils import TestNode, build_test_tree, parse_unittest_args


class PayloadDict(TypedDict):
    cwd: str
    status: Literal["success", "error"]
    tests: TestNode
    errors: List[str]


def discover_tests(
    start_dir: str, pattern: str, top_level_dir: Optional[str]
) -> PayloadDict:
    """Returns a dictionary containing details of the discovered tests.

    The returned dict has the following keys:

    - cwd: Absolute path to the test start directory;
    - status: Test discovery status, can be "success" or "error";
    - tests: Discoverered tests if any, not present otherwise. Note that the status can be "error" but the payload can still contain tests;
    - errors: Discovery errors if any, not present otherwise.

    Payload format for a successful discovery:
    {
        "status": "success",
        "cwd": <test discovery directory>,
        "tests": <test tree>
    }

    Payload format for a successful discovery with no tests:
    {
        "status": "success",
        "cwd": <test discovery directory>,
    }

    Payload format when there are errors:
    {
        "cwd": <test discovery directory>
        "errors": [list of errors]
        "status": "error",
    }
    """
    cwd = os.path.abspath(start_dir)
    payload: PayloadDict = {"cwd": cwd, "status": "success"}
    tests = None
    errors: List[str] = []

    try:
        import django
        from django.conf import settings

        settings.configure()
        django.setup()

        loader = DiscoverRunner(top_level=top_level_dir)
        suite = loader.build_suite()

        tests, errors = build_test_tree(suite, cwd)  # test tree built succesfully here.

    except Exception:
        errors.append(traceback.format_exc())

    if tests is not None:
        payload["tests"] = tests

    if len(errors):
        payload["status"] = "error"
        payload["errors"] = errors

    return payload


if __name__ == "__main__":
    sys.path.insert(0, "/Users/francesco/Development/fiscozen/repo/fiscozen_django")
    os.environ.setdefault("DJANGO_SETTINGS_MODILE", "project.setting")
    import django
    django.setup()

    from django.test.runner import DiscoverRunner
    s = DiscoverRunner(verbosity=-1).build_suite()
    tests, errors = build_test_tree(s, os.getcwd())
    # Get unittest discovery arguments.
    # argv = sys.argv[1:]
    # index = argv.index("--udiscovery")

    # start_dir, pattern, top_level_dir = parse_unittest_args(argv[index + 1 :])
    #print(start_dir, top_level_dir)

    #sys.path.insert(0, start_dir)
    # print(sys.path)

    # Perform test discovery.
    # payload = discover_tests(start_dir, pattern, top_level_dir)

    sys.stdout.write(json.dumps(tests))

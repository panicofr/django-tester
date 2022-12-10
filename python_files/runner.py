from datetime import datetime, timedelta
import enum
from io import StringIO, TextIOBase
import json
import os
import sys
import traceback
from types import TracebackType
import unittest
from typing import List, Tuple, Type, TypedDict

PYTHON_FILES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PYTHON_FILES)
sys.path.insert(0, os.getcwd())

from django.test.runner import DiscoverRunner

from unittest_utils import parse_unittest_args

ErrorType = (
    Tuple[Type[BaseException], BaseException, TracebackType] | tuple[None, None, None]
)


class TestOutcomeEnum(str, enum.Enum):
    error = "error"
    failure = "failure"
    success = "success"
    skipped = "skipped"
    expected_failure = "expected-failure"
    unexpected_success = "unexpected-success"
    subtest_success = "subtest-success"
    subtest_failure = "subtest-failure"


class UnittestTestResult(unittest.TextTestResult):

    formatted: dict[str, dict[str, str | None]] = dict()

    def __init__(self, stream: TextIOBase, descriptions: bool, verbosity: int) -> None:
        super().__init__(stream, descriptions, verbosity)
        self.start_time: datetime | None = None

    def startTest(self, test: unittest.TestCase):
        super(UnittestTestResult, self).startTest(test)

    def startTestRun(self):
        self.start_time = datetime.now()

    def stopTestRun(self):
        self.end_time = datetime.now()

    @property
    def elapsed_time(self) -> timedelta:
        return (
            None
            if self.start_time is None
            else (datetime.now() - self.start_time) / timedelta(microseconds=1)
        )

    def addError(
        self,
        test: unittest.TestCase,
        err: ErrorType,
    ):
        super(UnittestTestResult, self).addError(test, err)
        self.formatResult(test, TestOutcomeEnum.error, err)

    def addFailure(
        self,
        test: unittest.TestCase,
        err: ErrorType,
    ):
        super(UnittestTestResult, self).addFailure(test, err)
        self.formatResult(test, TestOutcomeEnum.failure, err)

    def addSuccess(self, test: unittest.TestCase):
        super(UnittestTestResult, self).addSuccess(test)
        self.formatResult(test, TestOutcomeEnum.success)

    def addSkip(self, test: unittest.TestCase, reason: str):
        super(UnittestTestResult, self).addSkip(test, reason)
        self.formatResult(test, TestOutcomeEnum.skipped)

    def addExpectedFailure(self, test: unittest.TestCase, err: ErrorType):
        super(UnittestTestResult, self).addExpectedFailure(test, err)
        self.formatResult(test, TestOutcomeEnum.expected_failure, err)

    def addUnexpectedSuccess(self, test: unittest.TestCase):
        super(UnittestTestResult, self).addUnexpectedSuccess(test)
        self.formatResult(test, TestOutcomeEnum.unexpected_success)

    def addSubTest(
        self, test: unittest.TestCase, subtest: unittest.TestCase, err: ErrorType | None
    ):
        super(UnittestTestResult, self).addSubTest(test, subtest, err)
        self.formatResult(
            test,
            TestOutcomeEnum.subtest_failure if err else TestOutcomeEnum.subtest_success,
            err,
            subtest,
        )

    def formatResult(
        self,
        test: unittest.TestCase,
        outcome: str,
        error: ErrorType | None = None,
        subtest: unittest.TestCase | None = None,
    ):
        tb = None
        error_str = ""

        if error:
            exception_class, exception, tb = error
            error_str = f"{exception_class.__name__}: {str(exception)}"

            if tb is not None:
                # Format traceback
                formatted = traceback.format_exception(*error)
                # Remove the 'Traceback (most recent call last)'
                formatted = formatted[1:]
                tb = "".join(formatted)

        test_id = test.id()

        result = {
            "test": test.id(),
            "outcome": outcome,
            "message": error_str,
            "traceback": tb,
            "subtest": subtest.id() if subtest else None,
            "elapsed_time": self.elapsed_time,
        }

        self.formatted[test_id] = result


class TestExecutionStatus(str, enum.Enum):
    error = "error"
    success = "success"


TestResultTypeAlias = dict[str, dict[str, str | None]]


class PayloadDict(TypedDict):
    cwd: str
    status: TestExecutionStatus
    result: TestResultTypeAlias
    not_found: List[str]
    error: str


class CollectingTestRunner(unittest.TextTestRunner):
    resultclass = UnittestTestResult

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(stream=StringIO(), *args, **kwargs)


class CollectingDjangoRunner(DiscoverRunner):
    test_runner = CollectingTestRunner


if __name__ == "__main__":
    import django

    django.setup()

    test_runner = unittest.TextTestRunner(resultclass=UnittestTestResult)
    runner = CollectingDjangoRunner(verbosity=-1)

    if test_ids := parse_unittest_args(sys.argv).tests:
        s = runner.test_loader.loadTestsFromNames(test_ids)
    else:
        s = runner.build_suite()

    result = runner.run_suite(s)

    sys.stdout.write(json.dumps(result.formatted))

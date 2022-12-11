import {
    CancellationToken,
    Position,
    Range,
    TestItem,
    TestItemCollection,
    TestMessage,
    TestRunRequest,
    Uri,
} from "vscode";
import { executePythonProcess } from "../common/processRunner";
import { DjangoTestingContext } from "./context";
import { DiscoveredTestItem, DiscoveredTestNode, ExecutionTestPayload } from "./types";
import { getTestCaseNodes, isDiscoveredTestItem, isDiscoveredTestNode } from "./utils";

export class DjangoTestingService {
    public static async discoverTests(): Promise<void> {
        const process = executePythonProcess("discovery.py");
        let result = await process.complete();
        const testTreeJson = JSON.parse(result.output);
        this.createTestNode(testTreeJson, DjangoTestingContext.testController.items);
    }

    public static async runTests(
        request: TestRunRequest,
        token: CancellationToken,
        shouldDebug: boolean = false
    ): Promise<void> {
        const run = DjangoTestingContext.testController.createTestRun(request);
        const queue: TestItem[] = [];

        if (request.include) {
            request.include.forEach((test) => queue.push(test));
        } else {
            DjangoTestingContext.testController.items.forEach((test) => queue.push(test));
        }

        const testIds: string = queue.map((value) => value.id).join(" ");
        const testItemMap: Map<string, TestItem> = new Map();

        queue.forEach((testItem) => {
            const nodes = getTestCaseNodes(testItem);
            nodes.forEach((childTestItem) => {
                testItemMap.set(childTestItem.id, childTestItem);
                childTestItem.busy = true;
            });
        });

        const process = executePythonProcess("runner.py", ["--tests", testIds]);
        const result = await process.complete();
        const data: { [testId: string]: ExecutionTestPayload } = JSON.parse(
            result.output
        );

        Object.entries(data).forEach(([testId, testData]) => {
            const testItem = testItemMap.get(testId);
            const msg = new TestMessage(testData.message || "");
            if (!testItem) {
                return;
            }
            testItem.busy = false;

            if (testData.outcome === "success") {
                run.passed(testItem, testData.duration);
            }

            if (testData.outcome === "failure") {
                run.failed(testItem, msg, testData.duration);
            }

            if (testData.outcome === "error") {
                run.errored(testItem, msg, testData.duration);
            }
        });

        run.end();
    }

    private static createTestNode(
        nodeJson: DiscoveredTestNode | DiscoveredTestItem,
        collection: TestItemCollection
    ) {
        const testNode: TestItem = DjangoTestingContext.testController.createTestItem(
            nodeJson.runID,
            nodeJson.name,
            Uri.file(nodeJson.path)
        );

        if (isDiscoveredTestItem(nodeJson)) {
            testNode.range = new Range(
                new Position(Number(nodeJson.lineno) - 1, 0),
                new Position(Number(nodeJson.lineno), 0)
            );
        }

        collection.add(testNode);

        if (isDiscoveredTestNode(nodeJson)) {
            nodeJson.children.map(
                (childNodeJson: DiscoveredTestNode | DiscoveredTestItem) => {
                    this.createTestNode(childNodeJson, testNode.children);
                }
            );
        }
    }
}

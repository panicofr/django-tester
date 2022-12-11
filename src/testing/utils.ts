import { TestItem } from "vscode";
import { DiscoveredTestCommon, DiscoveredTestItem, DiscoveredTestNode } from "./types";

export function isDiscoveredTestNode(
    node: DiscoveredTestCommon
): node is DiscoveredTestNode {
    return Object.keys(node).includes("children");
}

export function isDiscoveredTestItem(
    node: DiscoveredTestCommon
): node is DiscoveredTestItem {
    return !isDiscoveredTestNode(node);
}

export function getTestCaseNodes(
    testNode: TestItem,
    collection: TestItem[] = []
): TestItem[] {
    if (!testNode.children.size) {
        collection.push(testNode);
    }

    testNode.children.forEach((c) => {
        if (testNode.children.size) {
            getTestCaseNodes(c, collection);
        } else {
            collection.push(testNode);
        }
    });
    return collection;
}

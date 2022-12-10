import * as vscode from 'vscode';
import { getTestCaseNodes } from './common/testItemUtilities';
import { runProcess } from './processRunner/processRunner';

const testController = vscode.tests.createTestController("django-tester", "Django Tests");

async function runHandler(
    shouldDebug: boolean,
    extensionUri: vscode.Uri,
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
) {
    const run = testController.createTestRun(request);
    const queue: vscode.TestItem[] = [];
  
    // Loop through all included tests, or all known tests, and add them to our queue
    if (request.include) {
        request.include.forEach(test => queue.push(test));
    } else {
        testController.items.forEach(test => queue.push(test));
    }
  
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const interpreterPath = await detectPythonPath(workspaceFolder);

    if (!interpreterPath) {
        return;
    }

    let testIds = queue.map(value => value.id).join(' ');
    
    const path = vscode.Uri.joinPath(extensionUri, 'python_files', 'runner.py');
    const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('django');
    const rootPath = vscode.Uri.joinPath(workspaceFolder.uri, settings.get("rootDir")).fsPath;

    const testItemMap: Map<string, vscode.TestItem> = new Map();

    queue.forEach((testItem) => {
        const nodes = getTestCaseNodes(testItem);
        nodes.forEach((childTestItem) => {
            testItemMap.set(childTestItem.id, childTestItem);
            childTestItem.busy = true;
        });
    });

    const process = runProcess(interpreterPath, [path.fsPath, '--tests', testIds], {'cwd': rootPath, 'environment': {'DJANGO_SETTINGS_MODULE': settings.get("settingsModule")}});
    const result = await process.complete();
    const data = JSON.parse(result.output);

    Object.entries(data).forEach(([testId, testData]) => {
        const testItem = testItemMap.get(testId);
        const msg = new vscode.TestMessage(testData.message);
        if (!testItem) {
            return;
        }
        testItem.busy = false;

        if (testData.outcome === 'success') {
            run.passed(testItem, testData.elapsed_time);
        }

        if (testData.outcome === 'failure') {
            run.failed(testItem, msg, testData.elapsed_time);
        }

        if (testData.outcome === 'error') {
            run.errored(testItem, msg, testData.elapsed_time);
        }
    });
    
    run.end();
}

async function detectPythonPath(workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
    const extension = vscode.extensions.getExtension('ms-python.python');
    if (!extension) {
        return undefined;
    }
    const usingNewInterpreterStorage = extension.packageJSON?.featureFlags?.usingNewInterpreterStorage;
    if (usingNewInterpreterStorage) {
        return extension.exports.settings.getExecutionDetails(workspaceFolder.uri).execCommand[0];
    }
    return undefined;
}

async function discoverTests(extensionUri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder) {
    const interpreterPath = await detectPythonPath(workspaceFolder);
    if (!interpreterPath) {
        return;
    }
    const path = vscode.Uri.joinPath(extensionUri, 'python_files', 'discovery.py');
    const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('django');
    const rootPath = vscode.Uri.joinPath(workspaceFolder.uri, settings.get("rootDir")).fsPath;
    const process = runProcess(interpreterPath, [path.fsPath, '--udiscovery', '-s', rootPath], {'cwd': rootPath, 'environment': {'DJANGO_SETTINGS_MODULE': settings.get("settingsModule")}});
    let result = await process.complete();
    return result.output;
}

function createTestNode(nodeJson: Object, parent: vscode.TestItem | undefined) {
    const testNode = testController.createTestItem(nodeJson.runID, nodeJson.name, vscode.Uri.file(nodeJson.path));
    if (nodeJson.type_ === 'test') {
        //testNode.tags = [RunTestTag, DebugTestTag];
        testNode.range = new vscode.Range(
            new vscode.Position(Number(nodeJson.lineno) - 1, 0),
            new vscode.Position(Number(nodeJson.lineno), 0),
        );
    }

    let collection = parent ? parent.children : testController.items;
    collection.add(testNode);

    let children = nodeJson.children || [];
    children.map((childNodeJson: Object) => {
        createTestNode(childNodeJson, testNode);
    });
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "django-tester" is now active!');

    let msPythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (!msPythonExtension) {
        return;
    }

    if (!msPythonExtension.isActive) {
        await msPythonExtension.activate();
    }
    await msPythonExtension.exports.ready;

    if (!vscode.workspace.workspaceFolders) {
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    let disposable = vscode.commands.registerCommand('django-tester.discover-tests', async () => {
        vscode.window.showInformationMessage('Hello World from django-tester!');

        const testTree = await discoverTests(context.extensionUri, workspaceFolder);
        if (!testTree) {
            return;
        }
        const testTreeJson = JSON.parse(testTree);
        createTestNode(testTreeJson, undefined);

        const runProfile = testController.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => {
                runHandler(false, context.extensionUri, request, token);
            }
        );
          
        const debugProfile = testController.createRunProfile(
            'Debug',
            vscode.TestRunProfileKind.Debug,
            (request, token) => {
                runHandler(true, context.extensionUri, request, token);
            }
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

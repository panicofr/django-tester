import * as vscode from 'vscode';
import { runProcess } from './processRunner/processRunner';

const testController = vscode.tests.createTestController("django-tester", "Django Tests");

async function runHandler(
    shouldDebug: boolean,
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
  
    // For every test that was queued, try to run it. Call run.passed() or run.failed().
    // The `TestMessage` can contain extra information, like a failing location or
    // a diff output. But here we'll just give it a textual message.
    while (queue.length > 0 && !token.isCancellationRequested) {
        const test = queue.pop()!;
  
        // Skip tests the user asked to exclude
        if (request.exclude?.includes(test)) {
            continue;
        }
  
        const start = Date.now();
        run.passed(test, Date.now() - start);
                    
        //run.failed(test, new vscode.TestMessage('Fail'), Date.now() - start);
  
        test.children.forEach(test => queue.push(test));
    }
  
    // Make sure to end the run after all tests have been executed:
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
    const rootPath = vscode.Uri.joinPath(workspaceFolder.uri, 'fiscozen_django');
    const process = runProcess(interpreterPath, [path.fsPath, '--udiscovery', '-s', rootPath.fsPath], {'cwd': rootPath.fsPath, 'environment': {'DJANGO_SETTINGS_MODULE': 'project.settings'}});
    let result = await process.complete();
    return result.output;
}

function createTestNode(nodeJson: Object, parent: vscode.TestItem | undefined) {
    const testNode = testController.createTestItem(nodeJson.id_, nodeJson.name);
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
                runHandler(false, request, token);
            }
        );
          
        const debugProfile = testController.createRunProfile(
            'Debug',
            vscode.TestRunProfileKind.Debug,
            (request, token) => {
                runHandler(true, request, token);
            }
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

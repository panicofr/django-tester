import {
    Extension,
    ExtensionContext,
    extensions,
    TestController,
    tests,
    Uri,
    workspace,
    WorkspaceConfiguration,
    WorkspaceFolder,
} from "vscode";
import { IProcessRunConfiguration } from "../common/types";

export class DjangoTestingContext {
    public static interpreterPath: Uri;
    public static projectDir: Uri;
    public static settingsModule: string;
    public static testController: TestController;
    public static djangoExtensionUri: Uri;

    private static msPythonExtension: Extension<any> | undefined;
    private static workspaceFolder: WorkspaceFolder;

    public static get env(): IProcessRunConfiguration {
        return {
            cwd: this.projectDir.fsPath,
            environment: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                DJANGO_SETTINGS_MODULE: this.settingsModule,
            },
        };
    }

    public static async initialize(extensionContext: ExtensionContext): Promise<void> {
        await this.activateDependencies();
        this.readExtensionSettings(extensionContext);
        this.pickWorkspaceFolder();
        this.findPythonInterpreter();
        this.readSettings();
        this.initializeTestController();
    }

    private static async activateDependencies(): Promise<void> {
        this.msPythonExtension = extensions.getExtension("ms-python.python");
        if (this.msPythonExtension === undefined) {
            throw new Error("VSCode Python extension not installed");
        }

        if (!this.msPythonExtension.isActive) {
            await this.msPythonExtension.activate();
        }
        await this.msPythonExtension.exports.ready;
    }

    private static readExtensionSettings(extensionContext: ExtensionContext): void {
        this.djangoExtensionUri = extensionContext.extensionUri;
    }

    private static pickWorkspaceFolder(): void {
        if (!workspace.workspaceFolders || !workspace.workspaceFolders.length) {
            throw new Error("Cannot find a valid workspace folder");
        }
        this.workspaceFolder = workspace.workspaceFolders[0];
    }

    private static findPythonInterpreter(): void {
        const usingNewInterpreterStorage: boolean =
            this.msPythonExtension?.packageJSON?.featureFlags?.usingNewInterpreterStorage;
        if (!usingNewInterpreterStorage) {
            throw new Error("Cannot find a valid Python interpreter");
        }
        const executionDetails =
            this.msPythonExtension?.exports.settings.getExecutionDetails(
                this.workspaceFolder.uri
            );
        this.interpreterPath = Uri.file(executionDetails.execCommand[0]);
    }

    private static readSettings(): void {
        const settings: WorkspaceConfiguration = workspace.getConfiguration("django");
        if (!settings) {
            throw new Error("Extension is not configured");
        }

        const projectDirName: string | undefined = settings.get("rootDir");
        if (!projectDirName) {
            throw new Error("Please fill the 'django.rootDir' setting");
        }
        this.projectDir = Uri.joinPath(this.workspaceFolder.uri, projectDirName);

        const settingsModuleName: string | undefined = settings.get("settingsModule");
        if (!settingsModuleName) {
            throw new Error("Please fill the 'django.settingsModule' setting");
        }
        this.settingsModule = settingsModuleName;
    }

    private static initializeTestController(): void {
        this.testController = tests.createTestController("django-tester", "Django Tests");
    }
}

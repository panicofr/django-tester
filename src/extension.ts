import { DjangoTestingContext } from "./testing/context";
import { DjangoTestingService } from "./testing/service";
import { getErrorMessage } from "./common/utils";
import { commands, ExtensionContext, TestRunProfileKind, window } from "vscode";

export async function activate(context: ExtensionContext) {
    try {
        await DjangoTestingContext.initialize(context);
    } catch (e) {
        window.showErrorMessage(getErrorMessage(e));
    }

    let disposable = commands.registerCommand(
        "django-tester.discover-tests",
        async () => {
            await DjangoTestingService.discoverTests();

            DjangoTestingContext.testController.createRunProfile(
                "Run",
                TestRunProfileKind.Run,
                (request, token) => {
                    DjangoTestingService.runTests(request, token);
                }
            );

            DjangoTestingContext.testController.createRunProfile(
                "Debug",
                TestRunProfileKind.Debug,
                (request, token) => {
                    DjangoTestingService.runTests(request, token, true);
                }
            );
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}

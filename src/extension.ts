import * as chrome_launcher from 'chrome-launcher';

import * as vscode from "vscode";
import axios from "axios";

class Debugee implements vscode.QuickPickItem {
  label: string;
  description?: string | undefined;
  detail?: string | undefined;
  picked?: boolean | undefined;
  alwaysShow?: boolean | undefined;

  constructor(public title: string,
    public desc: string,
    public type: string,
    public url: string,
    public webSocketDebuggerUrl: string) {

    this.label = title;
    this.detail = url;
  }
}

let _statusBarItem: vscode.StatusBarItem | null;

let currentRemoteDebuggingPort = 9222;

export function activate(context: vscode.ExtensionContext) {

  // Track currently webview panel

  // register a command that opens tasklist buffer
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-devtools:launch-chrome", async () => {
      currentRemoteDebuggingPort = await launchChrome();
      setStatus();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-devtools:kill-launched-chrome", () => {
      killLaunchedChrome();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-devtools:devtools-launch-url", () => {
      copyLaunchDevtoolsURL(context);
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand("vscode-devtools:launch", () => {
      launchDevtools(context);
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand("vscode-devtools:reset-remote-debugging-port", () => {
      currentRemoteDebuggingPort = vscode.workspace.getConfiguration('vscodeDevtools').defaultRemoteDebuggingPort;
      setStatus();
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand("vscode-devtools:open-settings", () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:sandipchitale.vscode-devtools');
    })
  );

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(setStatus));
  currentRemoteDebuggingPort = vscode.workspace.getConfiguration('vscodeDevtools').defaultRemoteDebuggingPort;

  // Create as needed
  if (!_statusBarItem) {
    _statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000
      );
      _statusBarItem.tooltip = 'Current : Default remote debugging ports';
      _statusBarItem.command = 'vscode-devtools:open-settings';
      setStatus();
      _statusBarItem.show();
  }
}

function setStatus() {
  if (_statusBarItem) {
    _statusBarItem.text = currentRemoteDebuggingPort  + ' : ' + vscode.workspace.getConfiguration('vscodeDevtools').defaultRemoteDebuggingPort;
  }
}

export function deactivate() {
  _statusBarItem = null;
}

async function launchChrome(): Promise<number> {
  // "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
  const launchedChrome = await chrome_launcher.launch({
    startingUrl: 'https://todomvc.com/examples/angularjs/#/'
  });
  return launchedChrome.port;
}

async function killLaunchedChrome() {
  chrome_launcher.killAll();
  currentRemoteDebuggingPort = vscode.workspace.getConfiguration('vscodeDevtools').defaultRemoteDebuggingPort;
  setStatus();
}


let currentPanel: vscode.WebviewPanel | undefined = undefined;

async function launchDevtools(context: vscode.ExtensionContext) {
  const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : vscode.ViewColumn.One;

  const debugees = await getDebugees();

  if (debugees.length === 0) {
    vscode.window.showInformationMessage(`
      No debuge target available.
      It appears Chrome instance runing in remote debugger mode (at port ${currentRemoteDebuggingPort}) is not running.
      You can launch one using the command:
      'chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check'
      or by invoking the command 'Launch Chrome in remote debugging mode'
      `);
    return;
  }

  const debugeesQuickPickItem = await selectDebugeee(debugees);
  if (!debugeesQuickPickItem) {
    return;
  }

  if (currentPanel) {
    // If we already have a panel, show it in the target column
    currentPanel.reveal(columnToShowIn);
  } else {
    // Otherwise, create a new panel
    currentPanel = vscode.window.createWebviewPanel(
      'devtools',
      'Devtools',
      columnToShowIn!,
      {
        enableScripts: true
        // ,retainContextWhenHidden: true
      }
    );
    let disposeSubscriptions: vscode.Disposable[] = [];
    // Reset when the current panel is closed
    const disposeSubscription = currentPanel.onDidDispose(
      () => {
        currentPanel = undefined;
        disposeSubscriptions = [];
      },
      null,
      disposeSubscriptions
    );
    disposeSubscriptions = [disposeSubscription];
  }

  const launchDevtoolsURL = getLaunchDevtoolsURL(debugeesQuickPickItem);
  currentPanel.webview.html = getWebviewContent(launchDevtoolsURL);

  function getWebviewContent(devtoolsUrl: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="shortcut icon" href="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" type="image/x-icon">
          <title>Any Devtools</title>
          <style>
            * {
              box-sizing: border-box;;
            }
            html,body {
              width: 100vw;
              height: 100vh;
            }
            body {
              padding: 0;
              margin: 0;
              background-color: white;
              color: black;
            }
            iframe {
              outline: 1px solid #999;
            }
          </style>
      </head>
      <body>
        <iframe id="devtools" width="100%" height="100%" src="${devtoolsUrl}"></iframe>
      </body>
      </html>
    `;
  }
}

async function copyLaunchDevtoolsURL(context: vscode.ExtensionContext) {
  const debugees = await getDebugees();
  if (debugees.length === 0) {
    vscode.window.showInformationMessage(`
      No debuge target available.
      It appears there Chrome instance runing in remote debugger mode is not running.
      You can launch one using the command:
      'chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check'
      or by invoking the command 'Launch Chrome in remote debugging mode'
      `);
    return;
  }

  const debugeesQuickPickItem = await selectDebugeee(debugees);
  if (!debugeesQuickPickItem) {
    return;
  }

  const launchDevtoolsURL = getLaunchDevtoolsURL(debugeesQuickPickItem);
  vscode.env.clipboard.writeText(launchDevtoolsURL);
  vscode.window.showInformationMessage(`Launch Devtools URL copied to clipboard:\n\n${launchDevtoolsURL}`);
}

async function selectDebugeee(debugees: any) {
  const debugeesQuickPickItems: Debugee[] = [];

  (debugees as any[]).forEach(debugee => {
    debugeesQuickPickItems.push(
      new Debugee(
        debugee.title,
        debugee.description,
        debugee.type,
        debugee.url,
        debugee.webSocketDebuggerUrl.replace('ws:/', 'ws=')
      )
    );
  });

  const debugeesQuickPickItem = await vscode.window.showQuickPick(debugeesQuickPickItems, {});
  return debugeesQuickPickItem;
}

async function getDebugees() {
  let debugees = [];
  try {
    debugees = (await axios.get(`http://localhost:${currentRemoteDebuggingPort}/json`)).data;
  } catch (e) {
    //
  }
  return debugees;
}

function getLaunchDevtoolsURL(debugeesQuickPickItem: Debugee): string {
  const hostedDevtoolsConfig = vscode.workspace.getConfiguration('vscodeDevtools').hostedDevtoolsUrl.replace('PORT', '' + currentRemoteDebuggingPort);
  return `${hostedDevtoolsConfig}?experiments=true&${debugeesQuickPickItem.webSocketDebuggerUrl}`;
}

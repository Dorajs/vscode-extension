// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Addon } from './model';
import path = require('path');
import { addonTreeDataProvider } from './explorer/AddonTreeDataProvider';
import { connector } from './connector';
import fs = require('fs-extra');
import * as AdmZip from 'adm-zip';

const watchers = new Map<string, vscode.FileSystemWatcher>();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "dora-vscode" is now active!');
  console.log(vscode.workspace.getConfiguration('dorajs'));
  bindWatcher();
  vscode.window.onDidChangeActiveTextEditor(bindWatcher);
  context.subscriptions.push(
    vscode.commands.registerCommand('dorajs.setHost', setHost),
    vscode.commands.registerCommand('dorajs.pushAddon', pushAddon),
    vscode.commands.registerCommand('dorajs.pullAddon', pullAddon),
    vscode.commands.registerCommand('dorajs.refreshExplorer', refreshExplorer),
    vscode.window.createTreeView("dorajs.addonExplorer", { treeDataProvider: addonTreeDataProvider, showCollapseAll: false }),
    vscode.workspace.onDidChangeConfiguration(onConfigChanged)
  );
}

function onConfigChanged(event: any) {
  console.log('onConfigChanged');
  if (event.affectsConfiguration('dorajs.autoPush')) {
    if (vscode.window.activeTextEditor) {

    }
  }
}

function bindWatcher() {
  if (!vscode.window.activeTextEditor) {
    return;
  }
  let path = vscode.window.activeTextEditor.document.fileName;
  if (path.search(/\.js$|\.json$/i) > 0 && !watchers.get(path)) {
    let watcher = vscode.workspace.createFileSystemWatcher(path);
    watcher.onDidChange(syncFileIfNeeded);
    watchers.set(path, watcher);
  }
}

function refreshExplorer() {
  addonTreeDataProvider.refresh();
}

async function setHost(holder: string = '') {
  const ip = await vscode.window.showInputBox({
    placeHolder: 'Example: 192.168.0.100',
    value: holder || getConfig().get('host') || ''
  });
  if (!ip) {
    return;
  }
  if (isIP(ip)) {
    let pong = await connector.ping(ip);
    if (!pong) {
      showError("Connot connect Dora.js, check your network");
      setHost(ip);
      return;
    }
    let config = getConfig();
    config.update('host', ip, true);
    showMessage(`Connect ${ip} success`);
    addonTreeDataProvider.refresh();
  } else {
    showError("Invalid ip address.");
    setHost(ip);
  }
}

function syncFileIfNeeded() {
  if (getConfig().get('autoPush')) {
    pushAddon();
  }
}

async function pullAddon(addon: Addon) {
  if (addon === undefined || typeof addon !== 'object') {
    showError("Must select an addon");
    return;
  }
  const connected = await connector.connect();
  if (!connected) {
    showError('Host is unavailable');
    return;
  }
  const defaultUri: vscode.Uri | undefined = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
  const options: vscode.OpenDialogOptions = {
    defaultUri,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select",
  };
  const directory: vscode.Uri | undefined = await vscode.window.showSaveDialog(options);
  if (!directory) {
    return;
  }
  const dest = directory.fsPath;
  if (dest === undefined) {
    return;
  }
  try {
    let file = await connector.pull(addon);
    console.log('pull finished, starting unzip...');
    var zip = new AdmZip(<string>file);
    zip.extractAllTo(dest);
    fs.unlinkSync(file);
    const uri = vscode.Uri.file(dest);
    console.log('unzip successfully, open the folder');
    showMessage(`Pull ${addon.label} successfully!`);
    vscode.commands.executeCommand('vscode.openFolder', uri);
  } catch (err) {
    console.error(err);
    showError('Download addon unsuccessfully');
  }
}

async function pushAddon() {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    showError("No active text editor, please open any text file");
    return;
  }
  var filePath = path.resolve(editor.document.fileName);
  var directory = parentFolder(filePath);
  var directoryRoot = path.parse(directory).root;
  while (directory !== directoryRoot) {
    let files = fs.readdirSync(directory);
    const identifiers = ['package.json'];
    if (identifiers.reduce((value, identifier) => value && files.includes(identifier), true)) {
      break;
    }
    directory = parentFolder(directory);
  }
  if (directory === directoryRoot) {
    showError("This project is not a Dora.js addon project");
    return;
  }
  // Sync as package
  if (!fs.existsSync(path.join(directory, 'dist'))) {
    fs.mkdirSync(path.join(directory, 'dist'));
  }
  try {
    console.log(`start build`);
    const file = await build(directory);
    console.log(`build success`);
    let resp = await connector.push(file);
    console.log(`push finished: ret=${resp.ret}, msg=${resp.msg}`);
  } catch (err) {
    showError(err);
  }
}

async function build(srcFolder: string): Promise<fs.PathLike> {
  var name = path.basename(srcFolder);
  var dest = path.resolve(srcFolder, `dist/${name}.dora`);
  const { execSync } = require('child_process');
  execSync(`yarn pack --cwd=${srcFolder} -f ${dest}`);
  return Promise.resolve(dest);
}

// Find the parent folder
function parentFolder(filePath: string) {
  return path.dirname(filePath);
}

function getConfig() {
  return vscode.workspace.getConfiguration('dorajs');
}

// Show info message
function showMessage(msg: string) {
  console.log(msg);
  vscode.window.showInformationMessage(`[Dora.js] ${msg}`);
}

// Show error message
function showError(error: string) {
  console.error(error);
  if (vscode.debug) {
    vscode.window.showErrorMessage(`[Dora.js] ${error}`);
  }
}

function isIP(str: string) {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(str);
}
// this method is called when your extension is deactivated
export function deactivate() { }

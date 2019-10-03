// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Addon } from './model';
import * as path from 'path';
import { addonTreeDataProvider } from './explorer/AddonTreeDataProvider';
import { connector } from './connector';
import fs = require('fs');
import * as AdmZip from 'adm-zip';
const watchers = new Map<string, vscode.FileSystemWatcher>();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "dora-vscode" is now active!');
	console.log(vscode.workspace.getConfiguration('dora'));
	bindWatcher();
	vscode.window.onDidChangeActiveTextEditor(bindWatcher);
	context.subscriptions.push(
		vscode.commands.registerCommand('dora.setHost', setHost),
		vscode.commands.registerCommand('dora.pushAddon', pushAddon),
		vscode.commands.registerCommand('dora.pullAddon', pullAddon),
		vscode.commands.registerCommand('dora.refreshExplorer', refreshExplorer),
		vscode.window.createTreeView("dora.addonExplorer", { treeDataProvider: addonTreeDataProvider, showCollapseAll: false }),
		vscode.workspace.onDidChangeConfiguration(onConfigChanged)
	);
}

function onConfigChanged(event: any) {
	console.log('onConfigChanged');
	if (event.affectsConfiguration('dora.autoPush')) {
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
		value: holder
	});
	if (!ip) {
		return;
	}
	if (isIP(ip)) {
		let pong = await connector.ping(ip);
		if (!pong) {
			showError("Connot connect to Dora, check your network");
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
	const directory: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
	if (!directory || directory.length < 1) {
		return;
	}
	const folder = directory[0].fsPath;
	if (folder === undefined) {
		return;
	}
	try {
		let file = await connector.pull(addon);
		console.log('pull finished');
		var zip = new AdmZip(<string>file);
		zip.extractAllTo(folder);
		fs.unlinkSync(file);
		const uri = vscode.Uri.file(folder);
		vscode.commands.executeCommand('vscode.openFolder', uri);
	} catch (err) {
		console.error(err);
		showError('Download addon unsuccessfully');
	}
}

async function pushAddon() {
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		showError("Failed to push addon");
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
		showError("This project is not a Dora project");
		return;
	}
	// Sync as package
	if (!fs.existsSync(path.join(directory, '.output'))) {
		fs.mkdirSync(path.join(directory, '.output'));
	}
	try {
		console.log(`start build`);
		const outputFile = await buildPkg(directory);
		console.log(`build success`);
		let resp = await connector.push(outputFile);
		console.log('push finished');
		console.log(resp);
	} catch (err) {
		showError(err);
	}
}

async function buildPkg(srcFolder: string): Promise<fs.PathLike> {
	var fs = require('fs');
	var archiver = require('archiver');
	var zipArchive = archiver('zip');
	var name = path.basename(srcFolder);
	var outputFile = path.resolve(srcFolder, '.output', `${name}.dora`);
	var output = fs.createWriteStream(outputFile);
	return new Promise((resolve, reject) => {
		output.on('close', function () {
			resolve(outputFile);
		});

		zipArchive.pipe(output);

		// zipArchive.bulk([
		// 	{ cwd: srcFolder, src: [], expand: true, ignore: ['node_modules/**'] }
		// ]);
		zipArchive.glob('**/*', {
			cwd: srcFolder,
			ignore: ['node_modules/**']
		});

		zipArchive.finalize(function (err: any, bytes: any) {
			if (err) {
				reject(err);
			}
		});
	});
}

// Find the parent folder
function parentFolder(filePath: string) {
	return path.dirname(filePath);
}

function getConfig() {
	return vscode.workspace.getConfiguration('dora');
}

// Show info message
function showMessage(msg: string) {
	console.log(msg);
	vscode.window.showInformationMessage(`[Dora] ${msg}`);
}

// Show error message
function showError(error: string) {
	console.error(error);
	if (vscode.debug) {
		vscode.window.showErrorMessage(`[Dora] ${error}`);
	}
}

function isIP(str: string) {
	return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(str);
}
// this method is called when your extension is deactivated
export function deactivate() { }

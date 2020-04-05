// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { Addon } from './model'
import path = require('path')
import os = require('os')
import { addonTreeDataProvider } from './explorer/AddonTreeDataProvider'
import { connector } from './connector'
import fs = require('fs-extra')
import * as AdmZip from 'adm-zip'
let created_files: string[] = []
const watchers = new Map<string, vscode.FileSystemWatcher>()
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  bindWatcher()
  vscode.window.onDidChangeActiveTextEditor(bindWatcher)
  context.subscriptions.push(
    vscode.commands.registerCommand('dorajs.setHost', setHost),
    vscode.commands.registerCommand('dorajs.push', push),
    vscode.commands.registerCommand('dorajs.pull', pull),
    vscode.commands.registerCommand('dorajs.download', download),
    vscode.commands.registerCommand('dorajs.refreshExplorer', refreshExplorer),
    vscode.window.createTreeView('dorajs.addonExplorer', {
      treeDataProvider: addonTreeDataProvider,
      showCollapseAll: false
    }),
    vscode.workspace.onDidChangeConfiguration(onConfigChanged)
  )
}

function onConfigChanged(event: any) {
  console.log('onConfigChanged')
  if (event.affectsConfiguration('dorajs.autoPush')) {
    if (vscode.window.activeTextEditor) {
    }
  }
}

function bindWatcher() {
  if (!vscode.window.activeTextEditor) {
    return
  }
  let path = vscode.window.activeTextEditor.document.fileName
  if (path.search(/\.js$|\.json$/i) > 0 && !watchers.get(path)) {
    let watcher = vscode.workspace.createFileSystemWatcher(path)
    watcher.onDidChange(syncFileIfNeeded)
    watchers.set(path, watcher)
  }
}

function refreshExplorer() {
  addonTreeDataProvider.refresh()
}

async function setHost(holder: string = '') {
  const ip = await vscode.window.showInputBox({
    placeHolder: 'Example: 192.168.0.100',
    value: holder || getConfig().get('host') || ''
  })
  if (!ip) {
    return
  }
  if (isIP(ip)) {
    let pong = await connector.ping(ip)
    if (!pong) {
      showError('Connot connect Dora.js, check your network')
      setHost(ip)
      return
    }
    let config = getConfig()
    config.update('host', ip, true)
    showMessage(`Connect ${ip} success`)
    addonTreeDataProvider.refresh()
  } else {
    showError('Invalid ip address.')
    setHost(ip)
  }
}

function syncFileIfNeeded() {
  if (getConfig().get('autoPush')) {
    push()
  }
}

async function workspace(): Promise<string> {
  return ''
}

function selectDefaultPath(): string {
  if (!vscode.workspace.workspaceFolders) {
    return os.homedir()
  }
  const p = vscode.workspace.workspaceFolders[0].uri.fsPath
  return path.basename(p)
}

function isDirEmpty(dir: string): boolean {
  return fs.readdirSync(dir).length == 0
}

async function download(addon: Addon) {
  if (addon === undefined || typeof addon !== 'object') {
    showError('Must select an addon')
    return
  }
  const connected = await connector.connect()
  if (!connected) {
    showError('Host is unavailable')
    return
  }
  // const defaultPath = path.resolve(selectDefaultPath(), addon.displayName)
  // const directory = await vscode.window.showSaveDialog(options)
  const openTarget = await vscode.window.showOpenDialog({
    defaultUri: vscode.Uri.file(selectDefaultPath()),
    openLabel: '保存到这个目录',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false
  })
  if (!openTarget) {
    return
  }
  const dest = openTarget[0].fsPath
  if (dest === undefined) {
    return
  }
  if (!isDirEmpty(dest)) {
    console.log(`${dest} is not empty`)
    const result = await vscode.window.showWarningMessage(`${dest}\n文件夹非空，是否覆盖`, { modal: true }, "确认覆盖")
    if (result == undefined) {
      return
    }
    console.log(result)
  }
  try {
    let file = await connector.pull(addon)
    console.log('pull finished, starting unzip...')
    var zip = new AdmZip(<string>file)
    zip.extractAllTo(dest)
    fs.unlinkSync(file)
    const uri = vscode.Uri.file(dest)
    console.log(`unzip successfully, open the folder: ${dest}`)
    showMessage(`成功下载 ${addon.displayName}!`)
    vscode.commands.executeCommand('vscode.openFolder', uri)
  } catch (err) {
    console.error(err)
    showError('Failed to download addon')
  }
}

async function pull() {
  let editor = vscode.window.activeTextEditor
  if (!editor) {
    showError('请选打开扩展目录下的任意一个文件')
    return
  }
}

async function push() {
  let editor = vscode.window.activeTextEditor
  if (!editor) {
    showError('请选打开扩展目录下的任意一个文件')
    return
  }
  var filePath = path.resolve(editor.document.fileName)
  var directory = parentFolder(filePath)
  var directoryRoot = path.parse(directory).root
  while (directory !== directoryRoot) {
    let files = fs.readdirSync(directory)
    const identifiers = ['package.json']
    if (identifiers.reduce((value, identifier) => value && files.includes(identifier), true)) {
      break
    }
    directory = parentFolder(directory)
  }
  if (directory === directoryRoot) {
    showError('This project is not a Dora.js addon project')
    return
  }
  try {
    console.log(`start build`)
    const file = await build(directory)
    console.log(`build success`)
    let resp = await connector.push(file)
    console.log(`push finished: code=${resp.code}, message=${resp.message}`)
  } catch (err) {
    showError(err)
  }
}

async function build(srcFolder: string): Promise<fs.PathLike> {
  const uniqueFilename = require('unique-filename')
  const dest = uniqueFilename(os.tmpdir())
  const fs = require('fs')
  const archiver = require('archiver')('zip')
  const output = fs.createWriteStream(dest)
  created_files.push(dest)
  return new Promise((resolve, reject) => {
    output.on('close', function () {
      resolve(dest)
    })

    archiver.pipe(output)

    // zipArchive.bulk([
    // 	{ cwd: srcFolder, src: [], expand: true, ignore: ['node_modules/**'] }
    // ]);
    archiver.glob('**/*', {
      cwd: srcFolder,
      ignore: ['node_modules/**']
    })

    archiver.finalize(function (err: any, bytes: any) {
      if (err) {
        reject(err)
      }
    })
  })
}

// Find the parent folder
function parentFolder(filePath: string) {
  return path.dirname(filePath)
}

function getConfig() {
  return vscode.workspace.getConfiguration('dorajs')
}

// Show info message
function showMessage(msg: string) {
  console.log(msg)
  vscode.window.showInformationMessage(`[Dora.js] ${msg}`)
}

// Show error message
function showError(error: string) {
  console.error(error)
  if (vscode.debug) {
    vscode.window.showErrorMessage(`[Dora.js] ${error}`)
  }
}

function isIP(str: string) {
  const pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return pattern.test(str)
}
// this method is called when your extension is deactivated
export function deactivate() {
  for (const f of created_files) {
    fs.unlink(f, console.error)
  }
}

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { Addon } from '../model';
import { connector } from '../connector';

export class AddonTreeDataProvider implements vscode.TreeDataProvider<Addon> {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<Addon | undefined | null> = new vscode.EventEmitter<Addon | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: Addon): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.id === -1) {
            return {
                label: element.label,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                command: {
                    command: "dora.setHost",
                    title: "Connect Dora",
                },
            };
        }
        return {
            id: element.uuid,
            label: element.label,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: "dora.pullAddon",
                title: "Pull addon files",
                arguments: [element]
            },
            description: element.version,
            // tooltip: `Author: ${element.author}`
        };
    }

    public getChildren(element?: Addon | undefined): vscode.ProviderResult<Addon[] | any[]> {
        return connector.connect().then(connected => {
            if (!connected) {
                return [
                    new Addon({
                        id: -1,
                        uuid: null,
                        label: 'Connect Dora'
                    })
                ];
            } else {
                return connector.fetchAll();
            }
        });
    }

    public refresh() {
        this.onDidChangeTreeDataEvent.fire();
    }
}

export const addonTreeDataProvider: AddonTreeDataProvider = new AddonTreeDataProvider();
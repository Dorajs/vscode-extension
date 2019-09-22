import * as vscode from 'vscode';

export class Addon {
  constructor(private data: any) { }

  public get id(): number {
    return this.data.id;
  }

  public get uuid(): string {
    return this.data.uuid;
  }

  public get label(): string {
    return this.data.label;
  }

  public get version(): string {
    return this.data.version;
  }

  public get author(): string {
    return this.data.author;
  }
}
export class Addon {
  constructor(private data: any) {}

  public get id(): number {
    return this.data.id
  }

  public get uuid(): string {
    return this.data.uuid
  }

  public get displayName(): string {
    return this.data.displayName || this.data.label
  }

  public get version(): string {
    return this.data.version
  }

  public get author(): string {
    return this.data.author
  }
}

export class Result {
  constructor(private data: any) {}

  public get code() {
    return this.data.code
  }
  public get message() {
    return this.data.message
  }
}

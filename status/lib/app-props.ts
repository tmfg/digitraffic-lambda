export enum EndpointProtocol {
    HTTP,
    WebSocket
}

export interface MonitoredEndpoint {
    readonly name: string
    readonly url: string
    readonly protocol: EndpointProtocol
    readonly sendData?: any
}

export interface MonitoredApp {
    readonly name: string
    readonly hostPart: string
    readonly url: string
    readonly endpoints: MonitoredEndpoint[]
    readonly excluded: string[]
}

export interface Props {
    defaultLambdaDurationSeconds: number
    logsDestinationArn: string
    secretsManagerSecretArn: string
    monitoredApps: MonitoredApp[]
    allowFromIpAddresses: string[]
}

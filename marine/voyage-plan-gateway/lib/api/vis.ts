import axios from "axios";

export enum VisMessageType {
    RTZ = 'RTZ',
    TXT = 'TXT',
    S124 = 'S124'
}

export type VisMessage = {
    CallbackEndpoint: string
    id: string
    receivedAt: string
    FromOrgId: string
    FromOrgName: string
    FromServiceId: string
    messageType: string
    stmMessage: {
        message: string
    }
}

export type VisMessagesResponse = {
    readonly numberOfMessages: number
    readonly remainingNumberOfMessages: number
    readonly message: VisMessage[]
}

export async function getMessages(publicVisUrl: string, hmac: string): Promise<VisMessagesResponse> {
    const resp = await axios.get(publicVisUrl, {
        headers: {
            Accept: 'application/json',
            Authorization: 'HMAC GOES HERE'
        }
    });
    return resp.data as VisMessagesResponse;
}

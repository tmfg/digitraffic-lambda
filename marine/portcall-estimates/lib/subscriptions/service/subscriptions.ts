import {EstimateSubscription, TIME_FORMAT, validateSubscription} from "../model/subscription";
import moment from 'moment-timezone';
import {IDatabase} from "pg-promise";

const { v4: uuidv4 } = require('uuid');
import * as PinpointService from "./pinpoint";
import * as SubscriptionDB from '../db/db-subscriptions';
import {sendOKMessage} from "./pinpoint";
import {DbSubscription, updateNotifications} from "../db/db-subscriptions";
import * as ShiplistDb from "../db/db-shiplist";
import {inDatabase} from "../../../../../common/postgres/database";
import {ShiplistEstimate} from "../db/db-shiplist";
import {SubscriptionLocale} from "../smsutils";
import {getStartTime} from "../timeutil";

export const DYNAMODB_TIME_FORMAT = 'HHmm';

export enum SubscriptionType {
    VESSEL_LIST= "VESSEL_LIST"
}

export async function addSubscription(
    subscription: EstimateSubscription,
    locale: SubscriptionLocale) {

    if (validateSubscription(subscription)) {
        console.log(`Adding subscription for LOCODE ${subscription.locode}, at time ${subscription.time}`);
        await SubscriptionDB.insertSubscription({
            ID: uuidv4(),
            Time: moment(subscription.time, TIME_FORMAT, true).format(DYNAMODB_TIME_FORMAT),
            Type: SubscriptionType.VESSEL_LIST,
            Locode: subscription.locode.toUpperCase(),
            PhoneNumber: subscription.phoneNumber
        });

        await sendOKMessage(subscription.phoneNumber, locale);
    } else {
        await PinpointService.sendValidationFailedMessage(subscription.phoneNumber, locale);
        console.error('Invalid subscription');
    }
}

export async function sendSubscriptionList(destinationNumber: string) {
    const dbSubs = await SubscriptionDB.getSubscriptionList(destinationNumber);
    const subs = (dbSubs.Items as DbSubscription[])?.map(s => `${s.Locode} ${s.Time}`).join('\n');

    await PinpointService.sendSmsMessage(subs, destinationNumber);
}

export async function listSubscriptions(time: string): Promise<any> {
    const value = await SubscriptionDB.listSubscriptionsForTime(time);

    return value.Items;
}

export async function updateSubscriptionNotifications(id: string, estimates: ShiplistEstimate[]): Promise<any> {
    const notification = {};

    updateEstimates(notification, estimates);

//    console.info("got list %s to notifications %s", JSON.stringify(estimates), JSON.stringify(notification));

    return await SubscriptionDB.updateNotifications(id, notification);
}

export function updateSubscriptionEstimates(imo: number, locode: string) {
    SubscriptionDB.listSubscriptionsForLocode(locode).then(subscriptions => {
        subscriptions.Items.forEach((s: DbSubscription) => {
            updateSubscription(imo, s);
        });
    }).finally(() => {
        console.info("updateSubscriptionEstimates final!");
    });
}

function updateSubscription(imo: number, s: DbSubscription) {
    const startTime = getStartTime(s.Time);

    inDatabase(async (db: IDatabase<any, any>) => {
        return await ShiplistDb.findByLocodeAndImo(db, startTime, s.Locode, imo);
    }).then(estimates => {
        console.info("got estimates %s", JSON.stringify(estimates));

        if (estimates.length > 0 && s.ShipsToNotificate != null) {
            updateEstimates(s.ShipsToNotificate, estimates);

            sendSmsNotications(s.ShipsToNotificate);
            SubscriptionDB.updateNotifications(s.ID, s.ShipsToNotificate).then(_ => {
                console.info("notifications updated");
            });
        }
    }).finally(() => {
       console.info("updateSubscriptions final!");
    });
}

function sendSmsNotications(notification: any) {
    Object.keys(notification)?.forEach((portcall_id: string) => {
        Object.keys(notification[portcall_id])?.forEach((eventType: string) => {
            const data = notification[portcall_id][eventType];

            const portnet = data.Portnet ? moment(data.Portnet) : null;
            const vts = data.VTS ? moment(data.VTS) : null;
            const sent = moment(data.Sent);

            console.info("ship %s event %s portnet %s vts %s sent %s", portcall_id, eventType, portnet, vts, sent);

            const bestEstimate = vts || portnet;
            const difference = moment.duration(sent.diff(bestEstimate));

            console.info("difference is %s", difference);
        });
    });
}

function updateEstimates(notification: any, estimates: ShiplistEstimate[]) {
    console.info("new estimates %s", JSON.stringify(estimates));
    console.info("notification to update %s", JSON.stringify(notification));

    estimates.filter(e => {
        return e.portcall_id != null
    }).forEach(e => {
        const ship = notification[e.portcall_id] || {};
        const event = ship[e.event_type] || {};

        event[e.event_source] = moment(e.event_time).toISOString();
        event.Sent = event.Sent || event.VTS || event.Portnet;

        ship[e.event_type] = event;
        notification[e.portcall_id] = ship;
    });
}
import { OSLogField } from "./fields";
import { OSMonitor } from "./monitor";
import { BoolQuery, ExistsQuery, MatchPhraseQuery, Order, Query, RangeQuery, Sort } from "./queries";
import { OSTrigger, triggerWhenLineCountOutside, triggerWhenLinesFound } from "./triggers";

export interface MonitorConfig {
    env: string;
    index: string;
    cron: string;
    rangeInMinutes: number;
    phrases: Query[];
    slackDestinations: string[];
    throttleMinutes: number;
    messageSubject: string;
}

export function matchPhrase(field: OSLogField, query: string): MatchPhraseQuery {
    return { match_phrase: { [field]: { query } } };
}

export function exists(field: string): ExistsQuery {
    return {
        exists: {
            field
        }
    };
}

function bool(must: Query[], mustNot: Query[]): BoolQuery {
    return {
        bool: {
            must,
            must_not: mustNot
        }
    };
}

function sort(field: OSLogField, order: Order): Sort {
    return { [field]: { order } };
}

function createTimeRange(minutes: number): RangeQuery {
    return matchRange("@timestamp", `now-${minutes}m`, null);
}

/** inclusive range */
export function matchRange(
    field: OSLogField,
    // eslint-disable-next-line @rushstack/no-new-null
    from: string | number | null,
    // eslint-disable-next-line @rushstack/no-new-null
    to: string | number | null
): RangeQuery {
    return { range: { [field]: { from, to } } };
}

function getThrottle(config: MonitorConfig): number {
    return config.throttleMinutes ?? config.rangeInMinutes * 2;
}

export class OsMonitorBuilder {
    readonly config: MonitorConfig;

    readonly name: string;
    readonly cron: string;
    readonly index: string;
    readonly phrases: Query[];
    readonly notPhrases: Query[];

    messageSubject: string;
    rangeInMinutes: number;
    trigger: OSTrigger;

    constructor(name: string, config: MonitorConfig) {
        this.config = config;
        this.name = `${config.env.toUpperCase()} ${name}`;
        this.cron = config.cron;
        this.index = config.index;
        this.messageSubject = config.messageSubject;
        this.rangeInMinutes = config.rangeInMinutes;
        this.phrases = ([] as Query[]).concat(config.phrases);
        this.notPhrases = [];
        this.trigger = triggerWhenLinesFound(
            this.name,
            this.config.slackDestinations,
            getThrottle(config),
            this.messageSubject
        );
    }

    level(level: string): this {
        return this.and(matchPhrase("level", level));
    }

    logLine(value: string): this {
        return this.and(matchPhrase("log_line", value));
    }

    app(value: string): this {
        return this.and(matchPhrase("app", value));
    }

    loggerName(value: string): this {
        return this.and(matchPhrase("logger_name", value));
    }

    logGroup(value: string): this {
        return this.and(matchPhrase("@log_group", value));
    }

    logStream(value: string): this {
        return this.and(matchPhrase("@log_stream", value));
    }

    match(field: OSLogField, value: string): this {
        return this.and(matchPhrase(field, value));
    }

    withMessageSubject(subject: string): this {
        this.messageSubject = subject;

        return this;
    }

    and(...phrases: Query[]): this {
        this.phrases.push(...phrases);

        return this;
    }

    not(...phrases: Query[]): this {
        this.notPhrases.push(...phrases);

        return this;
    }

    /**
     * Timerange in minutes
     */
    minutes(minutes: number): this {
        this.rangeInMinutes = minutes;

        return this;
    }

    /**
     * trigger when outside inclusive range
     */
    notInRange(from: number, to: number): this {
        this.trigger = triggerWhenLineCountOutside(
            this.name,
            this.config.slackDestinations,
            getThrottle(this.config),
            from,
            to,
            this.messageSubject
        );

        return this;
    }

    moreThan(threshold: number = 0): this {
        this.trigger = triggerWhenLinesFound(
            this.name,
            this.config.slackDestinations,
            getThrottle(this.config),
            this.messageSubject,
            threshold
        );

        return this;
    }

    build(): OSMonitor {
        return {
            name: this.name,
            cron: this.cron,
            indices: [this.index],
            query: {
                size: 1,
                query: bool(
                    [
                        createTimeRange(this.rangeInMinutes),
                        matchPhrase("env", this.config.env),
                        ...this.phrases
                    ],
                    this.notPhrases
                ),
                sort: [sort("@timestamp", "desc")]
            },

            triggers: [this.trigger]
        };
    }
}

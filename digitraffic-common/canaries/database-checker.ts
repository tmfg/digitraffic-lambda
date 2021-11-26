import {withDbSecret} from "../secrets/dbsecret";
import {DTDatabase, inDatabaseReadonly} from "../postgres/database";

const synthetics = require('Synthetics');

abstract class DatabaseCheck<T> {
    readonly name: string;
    readonly sql: string;
    failed: boolean;

    protected constructor(name: string, sql: string) {
        this.name = name;
        this.sql = sql;
        this.failed = false;
    }

    abstract check(value: T): void;
}

class BaseResponse {};

class CountResponse extends BaseResponse {
    count: number;
}

class CountDatabaseCheck extends DatabaseCheck<CountResponse> {
    readonly minCount: number|null;
    readonly maxCount: number|null;

    constructor(name: string, sql: string, minCount: number|null, maxCount: number|null) {
        super(name, sql);

        if(minCount == null && maxCount == null) {
            throw new Error('no max or min given!');
        }

        this.minCount = minCount;
        this.maxCount = maxCount;
    }

    check(value: CountResponse) {
        if (!value) {
            this.failed = true;
            throw 'no return value';
        } else {
            if ('count' in value) {
                if(this.minCount && value.count < this.minCount) {
                    this.failed = true;
                    throw `count was ${value.count}, minimum is ${this.minCount}`;
                }
                if(this.maxCount && value.count > this.maxCount) {
                    this.failed = true;
                    throw `count was ${value.count}, max is ${this.maxCount}`;
                }
            } else {
                this.failed = true;

                console.info("received " + JSON.stringify(value));

                throw 'no count available';
            }
        }
    }
}

const stepConfig = {
    'continueOnStepFailure': true,
    'screenshotOnStepStart': false,
    'screenshotOnStepSuccess': false,
    'screenshotOnStepFailure': false
}

export class DatabaseChecker {
    readonly secret: string;
    checks: DatabaseCheck<BaseResponse>[];

    constructor(secret: string) {
        this.secret = secret;
        this.checks = [];

        synthetics.getConfiguration()
            .disableRequestMetrics();

        synthetics.getConfiguration()
            .withFailedCanaryMetric(true);
    }

    one(name: string, sql: string) {
        this.checks.push(new CountDatabaseCheck(name, sql, 1, 1));

        return this;
    }

    empty(name: string, sql: string) {
        this.checks.push(new CountDatabaseCheck(name, sql, null, 0));

        return this;
    }

    notEmpty(name: string, sql: string) {
        this.checks.push(new CountDatabaseCheck(name, sql, 1, null));

        return this;
    }

    async expect() {
        if (!this.checks.length) {
            throw 'No checks';
        }

        await withDbSecret(this.secret, async () => {
            await inDatabaseReadonly(async (db: DTDatabase) => {
                for (const check of this.checks) {
                    console.info("canary checking sql " + check.sql);

                    const value = await db.oneOrNone(check.sql);

                    synthetics.executeStep(check.name, () => {
                        check.check(value);
                    }, stepConfig);
                }
            });
        });

        if(this.checks.some(check => check.failed)) {
            throw 'Failed';
        }

        return 'OK';
    }
}

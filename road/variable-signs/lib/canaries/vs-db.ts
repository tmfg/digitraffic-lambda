import { DatabaseCountChecker } from "@digitraffic/common/dist/aws/infra/canaries/database-checker";

export const handler = () => {
    const checker = DatabaseCountChecker.createForProxy();

    checker.expectOneOrMore("devices not empty", "select count(*) from device");

    checker.expectOneOrMore(
        "data updated in last hour",
        `select count(*) from device_data where created_date > now() - interval '1 hours'`
    );

    checker.expectOneOrMore(
        "datex2 data updated in last 12 hours",
        `select count(*) from device_data_datex2 where updated_timestamp  > now() - interval '12 hours'`
    );

    return checker.expect();
};

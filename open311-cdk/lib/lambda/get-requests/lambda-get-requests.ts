import {initDbConnection} from 'digitraffic-lambda-postgres/database';
import {findAll} from "../../db/db-requests";

export const handler = async (): Promise<any> => {
    const db = initDbConnection(
        process.env.DB_USER as string,
        process.env.DB_PASS as string,
        process.env.DB_URI as string
    );

    const requests = await findAll(db);

    db.$pool.end();

    return requests;
};

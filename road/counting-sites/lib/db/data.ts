import {IDatabase, PreparedStatement} from "pg-promise";
import {ApiData} from "../model/data";

const SQL_INSERT_DATA =
    `insert into counting_site_data(id, counter_id, data_timestamp, count, status, interval)
    values (NEXTVAL('counting_site_data_id_seq'), $1, $2, $3, $4, $5)`;

const PS_INSERT_DATA = new PreparedStatement({
    name: 'insert-data',
    text: SQL_INSERT_DATA
})

export async function insertData(db: IDatabase<any, any>, site_id: number, interval: number, data: ApiData[]) {
    return Promise.all(data.map(d => {
        db.none(PS_INSERT_DATA, [site_id, d.date, d.counts, d.status, interval]);
    }));
}

export function findAllData(db: IDatabase<any, any>, counterId: number): Promise<any> {
    return db.any('select * from counting_site_data where counter_id = $1', [counterId]);
}
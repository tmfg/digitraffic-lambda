import * as SubSubjectsDb from '../db/subsubjects';
import {DTDatabase, inDatabase} from "digitraffic-common/postgres/database";
import {SubSubject} from "../model/subsubject";
import {Locale} from "../model/locale";

export async function findAll(locale: Locale): Promise<SubSubject[]> {
    return inDatabase(async (db: DTDatabase) => {
        return await SubSubjectsDb.findAll(locale, db);
    });
}

export async function update(
    subSubjects: SubSubject[]
): Promise<void> {
    const start = Date.now();
    return inDatabase(async (db: DTDatabase) => {
        return await SubSubjectsDb.update(subSubjects, db);
    }).then(a => {
        const end = Date.now();
        console.info("method=updateSubSubjects updatedCount=%d tookMs=%d", a.length, (end - start));
    });
}

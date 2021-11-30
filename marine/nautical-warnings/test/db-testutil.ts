import {dbTestBase as commonDbTestBase} from "digitraffic-common/test/db-testutils";
import {JSON_CACHE_KEY} from "digitraffic-common/db/cached";
import {DTDatabase} from "digitraffic-common/postgres/database";

export function dbTestBase(fn: (db: DTDatabase) => void) {
    return commonDbTestBase(
        fn, truncate, 'marine', 'marine', 'localhost:54321/marine',
    );
}

export function insertActiveWarnings<T>(db: DTDatabase, value: T): Promise<null> {
    return db.none('insert into cached_json(cache_id, content, last_updated) values ($1, $2, now())', [JSON_CACHE_KEY.NAUTICAL_WARNINGS_ACTIVE, value]);
}

export function insertArchivedWarnings<T>(db: DTDatabase, value: T): Promise<null> {
    return db.none('insert into cached_json(cache_id, content, last_updated) values ($1, $2, now())', [JSON_CACHE_KEY.NAUTICAL_WARNINGS_ARCHIVED, value]);
}

function truncate(db: DTDatabase): Promise<null> {
    return db.tx(async t => {
        return t.none('DELETE FROM cached_json');
    });
}

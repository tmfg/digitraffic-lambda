create index if not exists port_call_timestamp_shiplist_idx on port_call_timestamp(location_locode, event_source, ship_imo, portcall_id, event_time);
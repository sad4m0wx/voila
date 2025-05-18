#!/bin/bash

wget https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf
osmium tags-filter -R ile-de-france-latest.osm.pbf -o ile-de-france-foot-transit.osm.pbf -i osm-filters.json

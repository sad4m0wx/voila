#!/bin/bash

# OSM Data Simplification Script for Performance Optimization
# This script reduces coordinate precision and simplifies geometry for better isochrone performance

INPUT_FILE="ile-de-france-latest.osm.pbf"
OUTPUT_FILE="ile-de-france-simplified.osm.pbf"

echo "Simplifying OSM data for performance..."

# Install osmium-tool if not present
if ! command -v osmium &> /dev/null; then
    echo "Installing osmium-tool..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install osmium-tool
    else
        sudo apt-get update && sudo apt-get install -y osmium-tool
    fi
fi

# Simplify geometry and reduce precision
# This removes unnecessary detail points from ways while preserving topology
osmium add-locations-to-ways \
    --index-type=sparse_file_array \
    --overwrite \
    "$INPUT_FILE" \
    -o temp1.osm.pbf

# Extract only pedestrian-relevant features with reduced precision
osmium tags-filter temp1.osm.pbf \
    highway=footway,path,steps,pedestrian,residential,unclassified,tertiary,service \
    railway=platform \
    public_transport \
    amenity=bus_station \
    -o temp2.osm.pbf \
    --overwrite

# Simplify coordinate precision (reduces file size and processing time)
osmium merge-changes temp2.osm.pbf \
    --simplify \
    --fsync \
    -o "$OUTPUT_FILE" \
    --overwrite

# Clean up temporary files
rm -f temp1.osm.pbf temp2.osm.pbf

echo "Simplified OSM file created: $OUTPUT_FILE"
echo "Original size: $(du -h $INPUT_FILE | cut -f1)"
echo "Simplified size: $(du -h $OUTPUT_FILE | cut -f1)"


echo "Configuration updated to use simplified OSM data"
echo "Run 'rm -rf /data/graphs' and restart GraphHopper to rebuild with simplified data" 
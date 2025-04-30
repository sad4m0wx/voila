#!/bin/bash

INPUT_GTFS="IDFM-gtfs.zip"
OUTPUT_FILE="simplified-idfm-gtfs.zip"

# Process the GTFS feed with gtfstidy
# -T: Trip/Stop-time minimization (convert repeated trips to frequency entries)
# -c: Service minimization (optimize calendar dates)
# -m: Remeasure shapes (fill measurement gaps)
# -e: Default-value error handling

echo "Processing GTFS feed: $INPUT_GTFS"
gtfstidy -T -c -m -e $INPUT_GTFS -o $OUTPUT_FILE

# Verify the file was created
if [ -f "$OUTPUT_FILE" ]; then
    echo "Success! Simplified GTFS created at: $OUTPUT_FILE"
    #echo "Original size: $(du -h $INPUT_GTFS | cut -f1)"
    #echo "New size: $(du -h $OUTPUT_FILE | cut -f1)"
else
    echo "Error: Failed to create simplified GTFS file"
    exit 1
fi

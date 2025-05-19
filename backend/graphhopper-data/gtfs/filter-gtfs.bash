#!/bin/bash

INPUT_GTFS="IDFM-gtfs.zip"
OUTPUT_FILE="IDFM-gtfs-filtered.zip"
TEMP_DIR="gtfs_temp"

echo "Processing GTFS feed for frequency-based routing: $INPUT_GTFS"

# Create temporary directory
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# Extract the original GTFS
unzip -q ../$INPUT_GTFS

echo "Processing agency.txt..."
# Keep agency.txt as-is (usually small)
cp agency.txt agency_processed.txt

echo "Processing stops.txt..."
# Keep essential stop information
head -1 stops.txt > stops_processed.txt
tail -n +2 stops.txt | awk -F',' 'BEGIN {OFS=","} {print $1,$2,$3,$4,$5,$6,$7}' >> stops_processed.txt

echo "Processing routes.txt..."
# Keep essential route information
head -1 routes.txt > routes_processed.txt
tail -n +2 routes.txt | awk -F',' 'BEGIN {OFS=","} {print $1,$2,$3,$4,$5,$6,$7,$8}' >> routes_processed.txt

echo "Processing shapes.txt..."
# Keep shapes for route visualization (optional)
if [ -f shapes.txt ]; then
    cp shapes.txt shapes_processed.txt
fi

echo "Creating minimal calendar.txt..."
# Create a single service pattern that runs every day
cat > calendar_processed.txt << EOF
service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
ALWAYS,1,1,1,1,1,1,1,20240101,20251231
EOF

echo "Analyzing original trips and stop_times..."
# Create a simplified trips.txt and stop_times.txt using Python
python3 << 'EOF'
import csv
import sys
from collections import defaultdict

print("Reading original trips...")
# Read original trips and group by route_id
route_trips = defaultdict(list)
trip_routes = {}

with open('trips.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        route_id = row['route_id']
        trip_id = row['trip_id']
        route_trips[route_id].append(row)
        trip_routes[trip_id] = route_id

print(f"Found {len(trip_routes)} trips across {len(route_trips)} routes")

# Select one representative trip per route (preferably the first one alphabetically for consistency)
selected_trips = {}
for route_id, trips in route_trips.items():
    # Sort trips by trip_id to ensure consistent selection
    trips.sort(key=lambda x: x['trip_id'])
    selected_trip = trips[0]
    # Update service_id to our simplified one
    selected_trip['service_id'] = 'ALWAYS'
    selected_trips[route_id] = selected_trip

print(f"Selected {len(selected_trips)} representative trips")

# Write simplified trips.txt
with open('trips_processed.txt', 'w') as f:
    writer = csv.writer(f)
    # Write header
    writer.writerow(['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id'])
    
    for route_id, trip in selected_trips.items():
        writer.writerow([
            trip['route_id'],
            trip['service_id'],  # Now 'ALWAYS'
            trip['trip_id'],     # Keep original trip_id
            trip.get('trip_headsign', ''),
            trip.get('direction_id', ''),
            trip.get('shape_id', '')
        ])

# Create mapping of original trip_id to selected trip_id
trip_mapping = {}
for route_id, trip in selected_trips.items():
    selected_trip_id = trip['trip_id']
    # Map all trips of this route to the selected one
    for original_trip in route_trips[route_id]:
        trip_mapping[original_trip['trip_id']] = selected_trip_id

print("Reading original stop_times...")
# Read original stop_times and filter to only include selected trips
selected_trip_ids = set(trip['trip_id'] for trip in selected_trips.values())
filtered_stop_times = []

with open('stop_times.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trip_id = row['trip_id']
        if trip_id in selected_trip_ids:
            filtered_stop_times.append(row)

print(f"Filtered stop_times from original size to {len(filtered_stop_times)} entries")

# Group stop_times by trip and renumber sequences
trip_stop_times = defaultdict(list)
for st in filtered_stop_times:
    trip_stop_times[st['trip_id']].append(st)

# Sort by stop_sequence and renumber
for trip_id in trip_stop_times:
    trip_stop_times[trip_id].sort(key=lambda x: int(x['stop_sequence']))
    # Renumber sequences starting from 0
    for i, st in enumerate(trip_stop_times[trip_id]):
        st['stop_sequence'] = str(i)

# Write simplified stop_times.txt with relative times
with open('stop_times_processed.txt', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'])
    
    for trip_id, stop_times in trip_stop_times.items():
        for i, st in enumerate(stop_times):
            # Use relative times - 2 minutes between stops, starting at 6:00 AM
            minutes = 6 * 60 + i * 2  # 6 AM + 2 minutes per stop
            hours = minutes // 60
            mins = minutes % 60
            time_str = f"{hours:02d}:{mins:02d}:00"
            
            writer.writerow([
                st['trip_id'],
                time_str,  # arrival_time
                time_str,  # departure_time
                st['stop_id'],
                st['stop_sequence']
            ])

# Create frequencies.txt for all selected trips
with open('frequencies_processed.txt', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(['trip_id', 'start_time', 'end_time', 'headway_secs'])
    
    for trip in selected_trips.values():
        writer.writerow([
            trip['trip_id'],
            '06:00:00',  # start_time
            '22:00:00',  # end_time
            600          # headway_secs (10 minutes)
        ])

print("GTFS simplification completed successfully!")
EOF

echo "Creating optimized GTFS file..."
rm -f ../$OUTPUT_FILE

# Rename processed files
mv agency_processed.txt agency.txt
mv stops_processed.txt stops.txt
mv routes_processed.txt routes.txt
mv calendar_processed.txt calendar.txt
mv trips_processed.txt trips.txt
mv stop_times_processed.txt stop_times.txt
mv frequencies_processed.txt frequencies.txt

# Include shapes if it exists
if [ -f shapes_processed.txt ]; then
    mv shapes_processed.txt shapes.txt
fi

# Create the new GTFS zip with only essential files
zip -q ../$OUTPUT_FILE agency.txt stops.txt routes.txt calendar.txt trips.txt stop_times.txt frequencies.txt
if [ -f shapes.txt ]; then
    zip -q ../$OUTPUT_FILE shapes.txt
fi

# Clean up
cd ..
rm -rf $TEMP_DIR

# Verify the file was created and show size comparison
if [ -f "$OUTPUT_FILE" ]; then
    echo "Success! Frequency-based GTFS created at: $OUTPUT_FILE"
    if command -v stat >/dev/null 2>&1; then
        # For Linux/macOS
        if stat -c%s "$INPUT_GTFS" >/dev/null 2>&1; then
            # Linux
            orig_size=$(stat -c%s "$INPUT_GTFS")
            new_size=$(stat -c%s "$OUTPUT_FILE")
        else
            # macOS
            orig_size=$(stat -f%z "$INPUT_GTFS")
            new_size=$(stat -f%z "$OUTPUT_FILE")
        fi
        reduction=$(echo "scale=1; (1 - $new_size / $orig_size) * 100" | bc -l 2>/dev/null || echo "N/A")
        echo "Original size: $(du -h $INPUT_GTFS | cut -f1)"
        echo "New size: $(du -h $OUTPUT_FILE | cut -f1)"
        echo "Reduction: ${reduction}%"
    fi
else
    echo "Error: Failed to create optimized GTFS file"
    exit 1
fi

echo ""
echo "Note: This GTFS uses frequency-based routing with real trip IDs."
echo "Selected one representative trip per route, all running every 10 minutes from 6 AM to 10 PM."
echo "Stop times are relative (2 minutes between consecutive stops)."
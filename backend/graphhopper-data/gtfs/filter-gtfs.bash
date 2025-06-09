#!/bin/bash

INPUT_GTFS="IDFM-gtfs.zip"
OUTPUT_FILE="IDFM-gtfs-filtered.zip"
TEMP_DIR="gtfs_avg_temp"

echo "Creating GTFS for average travel time calculations..."

# Create temporary directory
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# Extract the original GTFS
unzip -q ../$INPUT_GTFS

echo "Processing agency.txt..."
cp agency.txt agency_processed.txt

echo "Processing stops.txt..."
# Keep essential stop information
head -1 stops.txt > stops_processed.txt
tail -n +2 stops.txt | awk -F',' 'BEGIN {OFS=","} {print $1,$2,$3,$4,$5,$6,$7}' >> stops_processed.txt

echo "Processing routes.txt..."
cp routes.txt routes_processed.txt

echo "Processing shapes.txt..."
if [ -f shapes.txt ]; then
    cp shapes.txt shapes_processed.txt
fi

echo "Creating simplified calendar..."
# Create a single service pattern for average calculations
cat > calendar_processed.txt << EOF
service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
AVERAGE_SERVICE,1,1,1,1,1,1,1,20240101,20251231
EOF

echo "Analyzing trips and extracting average travel times..."
python3 << 'EOF'
import csv
import sys
from collections import defaultdict
import statistics

print("Reading original trips...")
trips_by_route_dir = defaultdict(list)

with open('trips.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        route_id = row['route_id']
        direction_id = row.get('direction_id', '0')
        key = f"{route_id}_{direction_id}"
        trips_by_route_dir[key].append(row)

print(f"Found trips for {len(trips_by_route_dir)} route-direction combinations")

# Read stop_times and group by trip
print("Reading stop_times to calculate average travel times...")
trip_stop_times = defaultdict(list)

with open('stop_times.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trip_id = row['trip_id']
        trip_stop_times[trip_id].append(row)

# Calculate average travel patterns per route-direction
route_patterns = {}
route_travel_times = defaultdict(list)

for route_dir_key, trips in trips_by_route_dir.items():
    print(f"Processing {route_dir_key}...")
    
    # Collect all stop sequences for this route-direction
    all_sequences = []
    all_travel_times = []
    
    for trip in trips:
        trip_id = trip['trip_id']
        if trip_id not in trip_stop_times:
            continue
            
        # Sort stops by sequence
        stops = sorted(trip_stop_times[trip_id], 
                      key=lambda x: int(x.get('stop_sequence', '0')))
        
        if len(stops) < 2:
            continue
            
        # Extract stop sequence and calculate travel times
        stop_sequence = []
        travel_times = []
        
        prev_time_minutes = None
        for stop in stops:
            stop_sequence.append(stop['stop_id'])
            
            # Parse arrival time
            arrival_time = stop.get('arrival_time', '')
            if arrival_time and ':' in arrival_time:
                try:
                    time_parts = arrival_time.split(':')
                    hours = int(time_parts[0])
                    minutes = int(time_parts[1])
                    total_minutes = hours * 60 + minutes
                    
                    if prev_time_minutes is not None:
                        segment_time = total_minutes - prev_time_minutes
                        if 0 < segment_time < 60:  # Reasonable segment time (1-60 minutes)
                            travel_times.append(segment_time)
                    
                    prev_time_minutes = total_minutes
                except:
                    pass
        
        if len(stop_sequence) >= 2 and len(travel_times) >= 1:
            all_sequences.append(stop_sequence)
            all_travel_times.append(travel_times)
    
    if not all_sequences:
        continue
    
    # Find the most common stop sequence (mode)
    sequence_counts = defaultdict(int)
    for seq in all_sequences:
        seq_key = tuple(seq)
        sequence_counts[seq_key] += 1
    
    if not sequence_counts:
        continue
        
    # Get most common sequence
    most_common_sequence = max(sequence_counts.keys(), key=lambda x: sequence_counts[x])
    
    # Calculate average travel times for each segment
    segment_times = defaultdict(list)
    
    for i, travel_times in enumerate(all_travel_times):
        sequence = all_sequences[i]
        if tuple(sequence) == most_common_sequence and len(travel_times) == len(sequence) - 1:
            for j, segment_time in enumerate(travel_times):
                segment_times[j].append(segment_time)
    
    # Calculate median times for each segment (more robust than mean)
    average_segment_times = []
    for i in range(len(most_common_sequence) - 1):
        if i in segment_times and segment_times[i]:
            avg_time = statistics.median(segment_times[i])
            average_segment_times.append(max(1, int(avg_time)))  # At least 1 minute
        else:
            average_segment_times.append(2)  # Default 2 minutes
    
    route_patterns[route_dir_key] = {
        'stops': list(most_common_sequence),
        'segment_times': average_segment_times,
        'sample_trip': trips[0]  # Use first trip as template
    }

print(f"Created average patterns for {len(route_patterns)} route-directions")

# Write simplified trips
with open('trips_processed.txt', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id'])
    
    for route_dir_key, pattern in route_patterns.items():
        trip = pattern['sample_trip']
        writer.writerow([
            trip['route_id'],
            'AVERAGE_SERVICE',
            f"AVG_{route_dir_key}",  # New average trip ID
            trip.get('trip_headsign', ''),
            trip.get('direction_id', ''),
            trip.get('shape_id', '')
        ])

# Write stop_times with average travel times
with open('stop_times_processed.txt', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'])
    
    for route_dir_key, pattern in route_patterns.items():
        trip_id = f"AVG_{route_dir_key}"
        stops = pattern['stops']
        segment_times = pattern['segment_times']
        
        # Start at 8:00 AM for consistency
        current_minutes = 8 * 60
        
        for i, stop_id in enumerate(stops):
            hours = current_minutes // 60
            minutes = current_minutes % 60
            time_str = f"{hours:02d}:{minutes:02d}:00"
            
            writer.writerow([
                trip_id,
                time_str,  # arrival_time
                time_str,  # departure_time
                stop_id,
                str(i)     # stop_sequence
            ])
            
            # Add travel time to next stop
            if i < len(segment_times):
                current_minutes += segment_times[i]

# Create frequencies for average service every 15 minutes
with open('frequencies_processed.txt', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(['trip_id', 'start_time', 'end_time', 'headway_secs'])
    
    for route_dir_key in route_patterns.keys():
        trip_id = f"AVG_{route_dir_key}"
        writer.writerow([
            trip_id,
            '05:00:00',  # start_time
            '23:00:00',  # end_time
            900          # headway_secs (15 minutes)
        ])

print("Average travel time GTFS creation completed!")
EOF

echo "Creating average travel time GTFS file..."
rm -f ../$OUTPUT_FILE

# Rename processed files
mv agency_processed.txt agency.txt
mv stops_processed.txt stops.txt  
mv routes_processed.txt routes.txt
mv calendar_processed.txt calendar.txt
mv trips_processed.txt trips.txt
mv stop_times_processed.txt stop_times.txt
mv frequencies_processed.txt frequencies.txt

if [ -f shapes_processed.txt ]; then
    mv shapes_processed.txt shapes.txt
fi

# Create the new GTFS zip
zip -q ../$OUTPUT_FILE agency.txt stops.txt routes.txt calendar.txt trips.txt stop_times.txt frequencies.txt

if [ -f shapes.txt ]; then
    zip -q ../$OUTPUT_FILE shapes.txt
fi

# Clean up
cd ..
rm -rf $TEMP_DIR

# Verify the file was created and show size comparison
if [ -f "$OUTPUT_FILE" ]; then
    echo "Success! Average travel time GTFS created at: $OUTPUT_FILE"
    if command -v stat >/dev/null 2>&1; then
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
    echo "Error: Failed to create average travel time GTFS file"
    exit 1
fi

echo ""
echo "This GTFS contains average travel times derived from real data."
echo "Each route-direction has one trip with median segment travel times."
echo "Perfect for computing average journey times regardless of specific departure times." 
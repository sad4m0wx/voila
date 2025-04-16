use std::collections::HashMap;

// Node in the transit graph (a stop/station)
pub struct TransitNode {
    pub id: String,               // Unique identifier
    pub name: String,             // Station name
    pub location: (f64, f64),     // [longitude, latitude]
    pub lines: Vec<String>,       // Transit lines serving this stop
    pub node_type: NodeType,      // Type of transit node
}

// Edge in the transit graph (connection between stops)
pub struct TransitEdge {
    pub from_node: String,        // Origin node ID
    pub to_node: String,          // Destination node ID
    pub line_id: String,          // Transit line ID
    pub travel_time: u32,         // Travel time in seconds
    pub distance: f64,            // Distance in meters
    pub edge_type: EdgeType,      // Type of connection
}

pub enum NodeType {
    MetroStation,
    BusStop,
    TrainStation,
    TramStop,
    TransferPoint,
}

pub enum EdgeType {
    Transit { line_id: String, line_name: String, line_color: String },
    Walking { estimated: bool },
    Transfer { penalty: u32 },  // Transfer time penalty in seconds
}

// Main transit graph structure
pub struct TransitGraph {
    pub nodes: HashMap<String, TransitNode>,
    pub edges: Vec<TransitEdge>,
    pub metadata: TransitGraphMetadata,
}

pub struct TransitGraphMetadata {
    pub city: String,
    pub version: String,
    pub generated_date: String,
    pub node_count: usize,
    pub edge_count: usize,
}